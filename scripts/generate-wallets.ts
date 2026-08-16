import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import fs from "fs";

const COUNT = Number(process.argv[2] || 100);

const wallets = Array.from({ length: COUNT }, () => {
  const privateKey = generatePrivateKey();
  const address = privateKeyToAccount(privateKey).address;
  return { address, privateKey };
});

fs.writeFileSync("bot-wallets.json", JSON.stringify(wallets, null, 2));
console.log(`Generated ${COUNT} wallets -> bot-wallets.json`);
console.log(`First address: ${wallets[0].address}`);
