// firebase-tools enables configured providers, but does not disable false ones.
// Patch only anonymous sign-in; preserve all unrelated Authentication settings.
const fs = require("node:fs");
const { getProjectDefaultAccount } = require("firebase-tools/lib/auth");
const { requireAuth } = require("firebase-tools/lib/requireAuth");
const identity = require("firebase-tools/lib/gcp/identityPlatform");

async function main() {
  const project = JSON.parse(fs.readFileSync(".firebaserc", "utf8")).projects.default;
  const account = getProjectDefaultAccount(process.cwd());
  await requireAuth({ project, ...account, nonInteractive: true });
  let config = await identity.getConfig(project);
  if (!config.signIn?.email?.enabled || !config.signIn.email.passwordRequired)
    throw new Error("Deploy email/password Authentication first: firebase deploy --only auth");
  if (config.signIn?.anonymous?.enabled) {
    await identity.updateConfig(
      project,
      { signIn: { anonymous: { enabled: false } } },
      "signIn.anonymous.enabled",
    );
    config = await identity.getConfig(project);
  }
  if (config.signIn?.anonymous?.enabled)
    throw new Error("Anonymous Authentication is still enabled");
  console.log(`Authentication verified for ${project}: email/password enabled; anonymous disabled.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
