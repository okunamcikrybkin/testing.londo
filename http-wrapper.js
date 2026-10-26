// Compatibility entrypoint for hosting providers that expect http-wrapper.js.
import("./main.mjs").catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
