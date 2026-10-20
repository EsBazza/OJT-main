import {test} from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync} from "node:crypto";
import {docs} from "../src/lib/demo-data";
import {canonical,signPayload,verifyDocument} from "../src/lib/signing";

const pair=generateKeyPairSync("ed25519");
process.env.SIGNING_PRIVATE_KEY_PEM=pair.privateKey.export({type:"pkcs8",format:"pem"}).toString();
process.env.SIGNING_PUBLIC_KEY_PEM=pair.publicKey.export({type:"spki",format:"pem"}).toString();
process.env.SIGNING_KEY_ID="test-ed25519-key";
function signed(){const d={...docs[0],status:"Approved by Supervisor",approvedBy:"Adrian Cruz",approvedAt:new Date().toISOString(),signedAt:new Date().toISOString(),keyId:process.env.SIGNING_KEY_ID!,digest:"",signature:""};const r=signPayload(canonical(d));d.digest=r.digest;d.signature=r.signature;return d}

test("accepts an unchanged document signed by the trusted key",()=>assert.equal(verifyDocument(signed()).result,"VALID"));
test("detects modified document content",()=>{const d=signed();d.activities+=" Tampered";assert.equal(verifyDocument(d).result,"DOCUMENT CHANGED")});
test("rejects an invalid Ed25519 signature",()=>{const d=signed();d.signature=Buffer.alloc(64).toString("base64");assert.equal(verifyDocument(d).result,"INVALID SIGNATURE")});
test("rejects a signer without authorization for the company",()=>{const d=signed();d.signer="Unknown Person";d.digest=(awaitDigest(d));assert.equal(verifyDocument(d).result,"SIGNER NOT AUTHORIZED")});
function awaitDigest(d:ReturnType<typeof signed>){return signPayload(canonical(d)).digest}
