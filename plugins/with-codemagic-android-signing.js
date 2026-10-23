const { withAppBuildGradle } = require("expo/config-plugins");

const signingConfig = `        codemagicRelease {
            if (System.getenv("CM_KEYSTORE_PATH") != null) {
                storeFile file(System.getenv("CM_KEYSTORE_PATH"))
                storePassword System.getenv("CM_KEYSTORE_PASSWORD")
                keyAlias System.getenv("CM_KEY_ALIAS")
                keyPassword System.getenv("CM_KEY_PASSWORD")
            }
        }
`;

module.exports = function withCodemagicAndroidSigning(config) {
  return withAppBuildGradle(config, (mod) => {
    let contents = mod.modResults.contents;

    // Keep prebuild idempotent when the native project is regenerated.
    if (contents.includes("codemagicRelease")) return mod;

    const signingConfigsMarker = "    signingConfigs {\n";
    if (!contents.includes(signingConfigsMarker)) {
      throw new Error(
        "Codemagic Android signing could not find the generated signingConfigs block.",
      );
    }
    contents = contents.replace(
      signingConfigsMarker,
      `${signingConfigsMarker}${signingConfig}`,
    );

    const buildTypesStart = contents.indexOf("    buildTypes {");
    const releaseStart = contents.indexOf("        release {\n", buildTypesStart);
    const releaseEnd = contents.indexOf("\n        }\n", releaseStart);
    if (buildTypesStart < 0 || releaseStart < 0 || releaseEnd < 0) {
      throw new Error(
        "Codemagic Android signing could not find the generated release build type.",
      );
    }

    const releaseBlock = contents.slice(releaseStart, releaseEnd);
    const debugSigning = "            signingConfig signingConfigs.debug";
    if (!releaseBlock.includes(debugSigning)) {
      throw new Error(
        "Codemagic Android signing could not find the default release signing setting.",
      );
    }

    const releaseWithCodemagicSigning = releaseBlock.replace(
      debugSigning,
      `            if (System.getenv("CM_KEYSTORE_PATH") != null) {
                signingConfig signingConfigs.codemagicRelease
            } else {
                signingConfig signingConfigs.debug
            }`,
    );
    contents =
      contents.slice(0, releaseStart) +
      releaseWithCodemagicSigning +
      contents.slice(releaseEnd);

    mod.modResults.contents = contents;
    return mod;
  });
};
