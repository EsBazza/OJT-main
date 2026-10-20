const os = require("node:os");
const { syncBuiltinESMExports } = require("node:module");

try {
  os.userInfo();
} catch {
  os.userInfo = () => ({
    username: process.env.USERNAME || "test-runner",
    uid: -1,
    gid: -1,
    shell: null,
    homedir: os.tmpdir(),
  });
  syncBuiltinESMExports();
}
