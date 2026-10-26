import {test} from "node:test";
import assert from "node:assert/strict";
import {requireConsentConfiguration,ConsentConfigurationError} from "./oauth-config";
const valid={DISCORD_CLIENT_ID:"test-id",DISCORD_CLIENT_SECRET:"test-secret",DISCORD_OAUTH_ENCRYPTION_KEY:"ab".repeat(32)};
test("consent requires encryption key and exposes only missing variable names",()=>{
 assert.throws(()=>requireConsentConfiguration({...valid,DISCORD_OAUTH_ENCRYPTION_KEY:undefined}),e=>e instanceof ConsentConfigurationError&&e.message.includes("DISCORD_OAUTH_ENCRYPTION_KEY")&&!e.message.includes("test-secret"));
});
test("invalid key fails before OAuth without exposing its value",()=>{
 assert.throws(()=>requireConsentConfiguration({...valid,DISCORD_OAUTH_ENCRYPTION_KEY:"secret-invalid"}),e=>e instanceof ConsentConfigurationError&&!e.message.includes("secret-invalid"));
});
test("configured OAuth starts and missing client credentials are identified",()=>{
 assert.doesNotThrow(()=>requireConsentConfiguration(valid));
 for(const name of ["DISCORD_CLIENT_ID","DISCORD_CLIENT_SECRET"])assert.throws(()=>requireConsentConfiguration({...valid,[name]:undefined}),e=>e instanceof ConsentConfigurationError&&e.message.includes(name));
});
