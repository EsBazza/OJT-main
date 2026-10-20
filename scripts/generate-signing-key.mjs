import {generateKeyPairSync} from 'node:crypto';
import {writeFileSync} from 'node:fs';
const {privateKey,publicKey}=generateKeyPairSync('ed25519',{privateKeyEncoding:{type:'pkcs8',format:'pem'},publicKeyEncoding:{type:'spki',format:'pem'}});
writeFileSync('.signing-keys.local',`SIGNING_PRIVATE_KEY_PEM="${privateKey.replaceAll('\n','\\n')}"\nSIGNING_PUBLIC_KEY_PEM="${publicKey.replaceAll('\n','\\n')}"\nSIGNING_KEY_ID="ojt-ed25519-2026-01"\n`,{flag:'wx',mode:0o600});
console.log('Created .signing-keys.local (gitignored); copy its values into your server environment.');
