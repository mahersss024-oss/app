import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentRef,
} from "react";
import {
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { router } from "expo-router";
import * as Crypto from "expo-crypto";
import { fetch as expoFetch } from "expo/fetch";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type FileUIPart } from "ai";
import { useQueryClient } from "@tanstack/react-query";
import { getApiBaseUrl, getSessionToken } from "../../core/api";
import { useAuth } from "../../core/auth";
import { pickListingImages, type UploadAsset } from "../../core/media";
import {
  AppText,
  Button,
  Card,
  EmptyState,
  Field,
  Icon,
  LoadingState,
  PageHeader,
  Screen,
} from "../../ui";
import {
  clearAssistantHistory,
  readAssistantHistory,
  writeAssistantHistory,
} from "./history";
import { selectAssistantContext } from "./context";

const c = {
  primary: "#2866B2",
  ink: "#17324F",
  muted: "#738198",
  border: "#E4EAF3",
  soft: "#EDF4FE",
};

export function AssistantScreen() {
  const { user, status } = useAuth();
  if (status === "loading")
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  if (!user)
    return (
      <Screen>
        <PageHeader title="حمد، مساعدك في السوق" back />
        <EmptyState
          title="كيف أساعدك؟"
          message="سجّل دخولك للتحدث مع حمد وتجهيز إعلانك، أو اطّلع على سياسات السوق."
          icon="sparkles-outline"
          action={
            <Button title="تسجيل الدخول" onPress={() => router.push("/auth")} />
          }
        />
        <View style={{ gap: 8, padding: 18 }}>
          <Button title="كيف تعمل رسوم المنصة؟" variant="secondary" onPress={() => router.push("/policies/commissions")} />
          <Button title="شروط وسياسة الإعلانات" variant="ghost" onPress={() => router.push("/policies/listings")} />
        </View>
      </Screen>
    );
  return <Conversation key={user.id} ownerId={user.id} />;
}

function Conversation({ ownerId }: { ownerId: string }) {
  const [text, setText] = useState("");
  const [ready, setReady] = useState(false);
  const [creation, setCreation] = useState(false);
  const [attachments, setAttachments] = useState<UploadAsset[]>([]);
  const [picking, setPicking] = useState(false);
  const [historyError, setHistoryError] = useState(false);
  const conversationId = useRef(Crypto.randomUUID());
  const retained = useRef<{ source: string | null; files: FileUIPart[] }>({
    source: null,
    files: [],
  });
  const creationRef = useRef(creation);
  useEffect(() => {
    creationRef.current = creation;
  }, [creation]);
  const tokenAtMount = useRef(getSessionToken());
  const mounted = useRef(true);
  const list = useRef<ComponentRef<typeof ScrollView>>(null);
  const client = useQueryClient();
  // The transport retains these callbacks; they read refs only on a request,
  // never while the transport is constructed during render.

  const transport = useMemo(
    () =>
      // eslint-disable-next-line react-hooks/refs -- The constructor stores callbacks; each ref is read only when a later request invokes them.
      new DefaultChatTransport({
        api: `${getApiBaseUrl()}/api/chat`,
        fetch: (async (url, init) => {
          if (!mounted.current || getSessionToken() !== tokenAtMount.current)
            throw new Error("تغيّر الحساب. افتح المحادثة من جديد.");
          const response = await expoFetch(url as string, init as RequestInit);
          if (!response.ok)
            throw new Error(
              response.status === 429
                ? "طلبات كثيرة. انتظر قليلًا ثم أعد المحاولة."
                : response.status === 409
                  ? "تغيّر الحساب. افتح المحادثة من جديد."
                  : "تعذر الاتصال بحمد. حاول بعد قليل.",
            );
          if (
            !response.headers.get("content-type")?.includes("text/event-stream")
          )
            throw new Error("استجابة المحادثة غير صالحة. حاول بعد قليل.");
          return response;
        }) as typeof globalThis.fetch,
        prepareSendMessagesRequest: ({ messages, body }) => {
          const context = selectAssistantContext(messages);
          const latest = context.findLast((message) => message.role === "user");
          const files =
            latest?.parts.filter(
              (part): part is FileUIPart =>
                part.type === "file" && part.mediaType.startsWith("image/"),
            ) ?? [];
          if (files.length) retained.current = { source: latest!.id, files };
          const keepEarlier =
            !files.length &&
            context.some((message) => message.id === retained.current.source);
          return {
            headers: { Authorization: `Bearer ${tokenAtMount.current}` },
            body: {
              ...body,
              messages: context,
              chatOwnerId: ownerId,
              chatConversationId: conversationId.current,
              locationSettings: {
                country: "السعودية",
                currency: "SAR",
                language: "ar",
              },
              ...(creationRef.current ? { creationMethod: "chat" } : {}),
              retainedListingImages: keepEarlier ? retained.current.files : [],
              retainedListingImageMessageId: keepEarlier
                ? retained.current.source
                : undefined,
            },
          };
        },
      }),
    [ownerId],
  );
  const { messages, sendMessage, status, error, setMessages, stop } = useChat({
    id: `hamad-native:${ownerId}`,
    transport,
    onFinish: () => {
      void client.invalidateQueries({ queryKey: ["my-listings"] });
    },
  });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => {
    mounted.current = true;
    let cancelled = false;
    void readAssistantHistory(ownerId).then((saved) => {
      if (cancelled) return;
      if (saved) {
        conversationId.current = saved.conversationId;
        setMessages(saved.messages);
        setCreation(saved.creationMethod);
      }
      setReady(true);
    });
    return () => {
      cancelled = true;
      mounted.current = false;
      void stop();
      retained.current = { source: null, files: [] };
    };
  }, [ownerId, setMessages, stop]);
  useEffect(() => {
    if (!ready || busy || !messages.length) return;
    const timer = setTimeout(() => {
      if (mounted.current)
        void writeAssistantHistory(ownerId, {
          conversationId: conversationId.current,
          messages,
          creationMethod: creation,
        }).catch(() => setHistoryError(true));
    }, 350);
    return () => clearTimeout(timer);
  }, [ownerId, messages, creation, busy, ready]);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (next) => {
      if (next !== "active") void stop();
    });
    return () => sub.remove();
  }, [stop]);
  const send = (message: string, beginDraft = false) => {
    if (busy || !ready || picking || (!message.trim() && !attachments.length))
      return;
    if (message.length > 12_000) {
      Alert.alert(
        "الرسالة طويلة",
        "اختصر الرسالة إلى 12 ألف حرف وأرسل التفاصيل على أكثر من خطوة.",
      );
      return;
    }
    if (beginDraft) {
      creationRef.current = true;
      setCreation(true);
    }
    const files: FileUIPart[] = attachments
      .filter((asset) => asset.dataUrl)
      .map((asset) => ({
        type: "file",
        mediaType: "image/jpeg",
        filename: asset.name,
        url: asset.dataUrl!,
      }));
    setText("");
    setAttachments([]);
    void sendMessage(
      { text: message, files },
      {
        body: beginDraft
          ? { creationMethod: "chat", beginDraftWithHamad: true }
          : {},
      },
    );
  };
  const choose = async (source: "camera" | "library") => {
    setPicking(true);
    try {
      const files = await pickListingImages(
        source,
        8 - attachments.length,
        true,
      );
      if (mounted.current)
        setAttachments((current) => [...current, ...files].slice(0, 8));
    } catch (failure) {
      Alert.alert(
        "إضافة الصور",
        failure instanceof Error ? failure.message : "تعذر تجهيز الصور.",
      );
    } finally {
      if (mounted.current) setPicking(false);
    }
  };
  const reset = () =>
    Alert.alert(
      "محادثة جديدة",
      "سيُمسح النص المحفوظ لهذه المحادثة من هذا الجهاز. تبقى مسودات الإعلانات في حسابك.",
      [
        { text: "إلغاء", style: "cancel" },
        {
          text: "ابدأ من جديد",
          onPress: () => {
            void stop();
            retained.current = { source: null, files: [] };
            conversationId.current = Crypto.randomUUID();
            setMessages([]);
            setText("");
            setAttachments([]);
            setCreation(false);
            void clearAssistantHistory(ownerId).catch(() =>
              setHistoryError(true),
            );
          },
        },
      ],
    );
  return (
    <Screen scroll={false}>
      <PageHeader
        title="حمد"
        subtitle={creation ? "نجهّز مسودة إعلانك معًا" : "مساعدك في سوق حمد"}
        back
        right={
          <Button
            title="جديدة"
            variant="ghost"
            icon="add-outline"
            onPress={reset}
            disabled={!ready}
          />
        }
      />
      <KeyboardAvoidingView
        style={s.grow}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          ref={list}
          contentContainerStyle={s.messages}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() =>
            list.current?.scrollToEnd({ animated: true })
          }
        >
          {!ready ? (
            <LoadingState />
          ) : !messages.length ? (
            <>
              <View style={s.hero}>
                <View style={s.logo}>
                  <Icon name="sparkles" size={34} color={c.primary} />
                </View>
                <AppText variant="title">هلا، أنا حمد</AppText>
                <AppText color={c.muted} style={{ textAlign: "center" }}>
                  أساعدك تجهّز مسودة إعلان، وأجيب عن أسئلتك حول المنصة.
                </AppText>
              </View>
              <Card>
                <AppText variant="label">وش تحب نبدأ فيه؟</AppText>
                <Button
                  title="أجهّز إعلانًا مع حمد"
                  icon="add-circle-outline"
                  onPress={() =>
                    send(
                      "أختار الإنشاء مع حمد. ساعدني في تجهيز مسودة إعلان.",
                      true,
                    )
                  }
                />
                <Button
                  title="كيف تعمل رسوم المنصة؟"
                  variant="secondary"
                  onPress={() => send("كيف تعمل رسوم المنصة؟")}
                />
              </Card>
            </>
          ) : (
            messages.map((message) => (
              <View
                key={message.id}
                style={[
                  s.bubble,
                  message.role === "user" ? s.user : s.assistant,
                ]}
              >
                <AppText
                  variant="caption"
                  color={message.role === "user" ? "#D9E9FF" : c.primary}
                >
                  {message.role === "user" ? "أنت" : "حمد"}
                </AppText>
                {message.parts.map((part, index) =>
                  part.type === "text" ? (
                    <AssistantText
                      key={index}
                      text={part.text}
                      user={message.role === "user"}
                    />
                  ) : part.type === "file" &&
                    part.mediaType.startsWith("image/") ? (
                    <Image
                      key={index}
                      source={{ uri: part.url }}
                      style={s.chatImage}
                    />
                  ) : null,
                )}
                {(message.metadata as { creationChoice?: boolean } | undefined)
                  ?.creationChoice && (
                  <>
                    <Button
                      title="الإنشاء مع حمد"
                      variant="secondary"
                      disabled={busy}
                      onPress={() => send("أختار الإنشاء مع حمد.", true)}
                    />
                    <Button
                      title="الإنشاء اليدوي"
                      variant="ghost"
                      onPress={() => router.push("/create/manual")}
                    />
                  </>
                )}
              </View>
            ))
          )}
          {busy && (
            <View style={s.typing}>
              <Icon name="sparkles-outline" color={c.primary} size={18} />
              <AppText variant="caption" color={c.muted}>
                حمد يجهّز الرد بعد التحقق…
              </AppText>
            </View>
          )}
          {!!error && (
            <Card style={{ backgroundColor: "#FFF2F2" }}>
              <AppText color="#BB3C45">
                {error.message || "تعذر إكمال الرد. حاول بعد قليل."}
              </AppText>
              <AppText variant="caption" color={c.muted}>
                إذا كنت تجهّز إعلانًا، راجع مسوداتك قبل إعادة الإرسال.
              </AppText>
              <Button
                title="عرض مسوداتي"
                variant="secondary"
                onPress={() => router.push("/(tabs)/listings" as never)}
              />
            </Card>
          )}
        </ScrollView>
        <View style={s.composer}>
          {attachments.length > 0 && (
            <ScrollView horizontal contentContainerStyle={{ gap: 8 }}>
              {attachments.map((asset) => (
                <View key={asset.uri}>
                  <Image source={{ uri: asset.uri }} style={s.attachment} />
                  <Pressable
                    accessibilityLabel="إزالة المرفق"
                    style={s.remove}
                    onPress={() =>
                      setAttachments((current) =>
                        current.filter((item) => item.uri !== asset.uri),
                      )
                    }
                  >
                    <Icon name="close" color="#fff" size={14} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
          <View style={s.inputRow}>
            <View style={s.grow}>
              <Field
                value={text}
                onChangeText={setText}
                placeholder="اكتب لحمد…"
                multiline
                maxLength={12_000}
                editable={ready && !busy}
                style={{ minHeight: 52, maxHeight: 130 }}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={busy ? "إيقاف الرد" : "إرسال الرسالة"}
              disabled={
                !ready ||
                picking ||
                (!busy && !text.trim() && !attachments.length)
              }
              onPress={() => (busy ? void stop() : send(text))}
              style={[s.send, !ready && { opacity: 0.4 }]}
            >
              <Icon name={busy ? "stop" : "arrow-up"} color="#fff" size={23} />
            </Pressable>
          </View>
          <View style={s.tools}>
            <Pressable
              accessibilityLabel="إرفاق صور"
              disabled={busy || picking || attachments.length >= 8}
              onPress={() => void choose("library")}
            >
              <Icon name="images-outline" color={c.primary} size={22} />
            </Pressable>
            <Pressable
              accessibilityLabel="التقاط صورة"
              disabled={busy || picking || attachments.length >= 8}
              onPress={() => void choose("camera")}
            >
              <Icon name="camera-outline" color={c.primary} size={23} />
            </Pressable>
            <View style={s.grow}>
              <AppText variant="caption" color={c.muted}>
                {picking
                  ? "جارٍ تجهيز الصور…"
                  : "حمد يجهّز المسودة. أنت تراجع وتنشر."}
              </AppText>
            </View>
          </View>
          <AppText
            variant="caption"
            color={historyError ? "#BB3C45" : c.muted}
            style={{ fontSize: 10 }}
          >
            {historyError
              ? "تعذر حفظ التاريخ محليًا. قد لا يبقى بعد إغلاق التطبيق."
              : "يحفظ نص المحادثة مشفّرًا على هذا الجهاز حتى 30 يومًا، ويُمسح عند تسجيل الخروج. الصور لا تُحفظ في التاريخ."}
          </AppText>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function AssistantText({ text, user }: { text: string; user: boolean }) {
  const safe = text
    .replace(/\[\[SMARTSTORE_GOOGLE_AUTH_REQUIRED\]\]/g, "")
    .trim();
  const pattern = /\[([^\]]+)\]\((\/[^\s)]+)\)/g;
  const pieces: React.ReactNode[] = [];
  let cursor = 0;
  for (const match of safe.matchAll(pattern)) {
    pieces.push(safe.slice(cursor, match.index));
    const path = match[2];
    const mapped: Record<string, string> = {
      "/": "/(tabs)",
      "/account/listings": "/(tabs)/listings",
      "/account": "/(tabs)/account",
      "/conversations": "/(tabs)/messages",
      "/favorites": "/(tabs)/favorites",
      "/terms": "/policies/terms",
      "/privacy": "/policies/privacy",
      "/listing-policy": "/policies/listings",
      "/commission-policy": "/policies/commissions",
      "/delete-account": "/policies/deletion",
    };
    const target = mapped[path] ?? path;
    const allowed =
      Object.values(mapped).includes(target) ||
      target === "/create/manual" ||
      target === "/notifications" ||
      target === "/account/follows" ||
      /^\/listings\/[A-Za-z0-9_-]+$/.test(target) ||
      /^\/policies\/[A-Za-z0-9_-]+$/.test(target);
    pieces.push(
      allowed ? (
        <AppText
          key={`${match.index}`}
          color={user ? "#fff" : c.primary}
          style={{ textDecorationLine: "underline" }}
          onPress={() => router.push(target as never)}
        >
          {match[1]}
        </AppText>
      ) : (
        match[1]
      ),
    );
    cursor = match.index! + match[0].length;
  }
  pieces.push(safe.slice(cursor));
  return (
    <AppText selectable color={user ? "#fff" : c.ink}>
      {pieces}
    </AppText>
  );
}
const s = StyleSheet.create({
  grow: { flex: 1 },
  messages: { padding: 20, gap: 16, paddingBottom: 22, flexGrow: 1 },
  hero: { alignItems: "center", paddingTop: 26, paddingBottom: 18, gap: 12 },
  logo: {
    width: 84,
    height: 84,
    borderRadius: 28,
    backgroundColor: c.soft,
    alignItems: "center",
    justifyContent: "center",
  },
  bubble: { padding: 16, borderRadius: 20, gap: 8, maxWidth: "94%" },
  user: {
    backgroundColor: c.primary,
    alignSelf: "flex-start",
    borderBottomStartRadius: 5,
  },
  assistant: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: c.border,
    alignSelf: "flex-end",
    borderBottomEndRadius: 5,
  },
  chatImage: {
    width: 190,
    height: 160,
    borderRadius: 12,
    backgroundColor: c.soft,
  },
  typing: { flexDirection: "row", gap: 8, alignItems: "center" },
  composer: {
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: "#fff",
    padding: 14,
    paddingBottom: 22,
    gap: 9,
  },
  inputRow: { flexDirection: "row", gap: 10, alignItems: "flex-end" },
  send: {
    width: 50,
    height: 50,
    borderRadius: 17,
    backgroundColor: c.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  tools: { flexDirection: "row", alignItems: "center", gap: 18 },
  attachment: { width: 64, height: 64, borderRadius: 12 },
  remove: {
    position: "absolute",
    top: 2,
    end: 2,
    backgroundColor: "#17324FCC",
    borderRadius: 20,
    padding: 3,
  },
});
