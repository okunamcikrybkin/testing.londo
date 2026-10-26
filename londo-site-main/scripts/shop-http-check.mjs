// Start a local build with an isolated DATABASE_URL before running this read-only check.
import assert from "node:assert/strict";
const base=process.env.SHOP_CHECK_URL || "http://127.0.0.1:3197";
if(!["localhost","127.0.0.1"].includes(new URL(base).hostname))throw Error("Only a local test server is allowed");
for(const [method,path,status] of [["GET","/api/shop",403],["POST","/api/shop/items",403],["PATCH","/api/shop/items/test",403],["PATCH","/api/shop/settings",403],["GET","/api/shop/options",403],["POST","/api/shop/refresh",403],["POST","/api/shop/purchases/test/complete",403],["POST","/api/shop/purchases/test/refund",403],["GET","/api/internal/shop",401],["POST","/api/internal/shop",401]]) {const response=await fetch(base+path,{method,headers:{"content-type":"application/json"},...(method==="GET"?{}:{body:"{}"})});assert.equal(response.status,status,path);console.log(method+" "+path+": "+status);}
for(const path of ["/shop","/shop/settings","/shop/items/new","/shop/items/test","/shop/purchases"]){const response=await fetch(base+path,{redirect:"manual"});assert.equal(response.status,307,path);}
console.log("All 15 anonymous HTTP checks passed.");
