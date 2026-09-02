#!/usr/bin/env node
import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("아래 두 값을 Vercel(또는 .env.local)에 함께 넣으세요. 한 쌍만 사용해야 합니다.\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log("\n선택: VAPID_SUBJECT=mailto:your@email.com");
console.log("\n설정 후 반드시 재배포하고, 손님 앱에서 알림을 끄고 다시 켜 주세요.");
