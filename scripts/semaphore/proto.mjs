import { Identity } from "@semaphore-protocol/identity";
import { Group } from "@semaphore-protocol/group";
import { generateProof, verifyProof } from "@semaphore-protocol/proof";
const ids = Array.from({length:12},(_,i)=>new Identity(`verileaks-test-identity-${i}`));
const group = new Group(ids.map(i=>i.commitment));
console.time("proof");
const p = await generateProof(ids[3], group, 123n, 456n);
console.timeEnd("proof");
console.log(p.merkleTreeDepth, p.merkleTreeRoot, typeof p.points[0], await verifyProof(p));
