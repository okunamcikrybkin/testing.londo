import test from "node:test";
import assert from "node:assert/strict";
import {profileNameStyle} from "./name-accent";
test("identity highlight keeps exact red, green, purple and dark accent fills",()=>{
 for(const color of ["#FF0000","#00FF88","#7C3AED","#050505"])assert.equal(profileNameStyle(color).color,color);
 assert.equal(profileNameStyle("#ef0404").color,"#EF0404");
});
test("dark identity colors gain a static narrow edge without changing fill",()=>{
 const style=profileNameStyle("#050505");assert.equal(style.color,"#050505");assert.notEqual(style.textShadow,"none");
 assert.equal(profileNameStyle("#00FF88").textShadow,"none");
});
test("missing or injected accents use safe LONDO default",()=>{
 for(const value of [null,undefined,"","url(x)","#fff;display:none"])assert.equal(profileNameStyle(value).color,"#31D5BF");
});
