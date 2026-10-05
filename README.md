# chaat (챗)

치지직 라이브 채팅만 가볍게 보는 안드로이드 앱입니다.
영상은 TV·PC 같은 큰 화면으로 보고, 채팅은 폰으로 편하게 보세요.

> **비공식 앱입니다.** chaat은 NAVER 및 치지직(CHZZK)과 관련이 없으며, 공식적으로 제공·승인된 앱이 아닙니다.
> 치지직의 공개되지 않은 웹 API를 사용하므로 서비스 변경에 따라 언제든 동작하지 않을 수 있습니다.

## 주요 기능

- **채팅만 가볍게** — 영상 없이 실시간 채팅, 후원·구독 메시지, 공지를 봅니다. 이모티콘(구독 이모티콘 포함)과 프로필 사진도 보여요.
- **방송이 끝나도 그대로** — 방송이 끝난 채널의 채팅방도 계속 열려 있어요.
- **내 폰에 자동 저장** — 채팅방을 열어 둔 동안의 채팅이 이 폰에 저장되고, 날짜별로 다시 보고 검색할 수 있어요. 보관 기간(7일/30일/90일/무제한)을 고를 수 있어요.
- **즐겨찾기** — 자주 보는 채널을 모아 두고, 지금 방송 중인지와 시청자 수를 한눈에 봐요.
- **로그인 없이 보기** — 채팅 보기는 로그인이 필요 없어요. 채팅을 보내려면 네이버로 로그인해요.
- **매니저 기능** — 스트리머·매니저 계정이면 공지 올리기/내리기, 메시지 가리기를 할 수 있어요.
- **보기 설정** — 어두운/밝은 테마, 채팅 글자 크기, 한 줄/두 줄 채팅 모양.

## 설치 (APK)

[Releases](https://github.com/ouor/Chaat/releases)에서 최신 `chaat-*.apk`를 내려받아 설치하세요.
처음 설치할 때 안드로이드가 "출처를 알 수 없는 앱" 설치 허용을 물어볼 수 있어요.

- 지원: Android (iOS 빌드는 제공하지 않습니다)
- 현재 배포 APK는 **디버그 키로 서명**되어 있습니다. 나중에 정식 서명 키로 바뀌면 기존 앱을 지우고 다시 설치해야 할 수 있어요.

## 개인정보와 보안

- **채팅 기록은 이 폰에만 저장**됩니다. 어디로도 보내지 않으며, 안드로이드 백업에도 포함되지 않아요.
- **비밀번호는 저장하지 않습니다.** 로그인은 네이버 공식 로그인 페이지(`nid.naver.com`)에서 이루어지고, 로그인 후 받은 세션 정보(`NID_AUT`, `NID_SES` 쿠키)만 안드로이드 보안 저장소(Keystore)에 보관해요. 로그인 창의 쿠키 저장소는 로그인 직후 바로 지웁니다.
- 로그아웃하면 저장된 세션 정보가 이 폰에서 지워져요.
- 분석·광고·추적 SDK를 쓰지 않습니다. 앱은 치지직/네이버 서버하고만 통신해요.

## 소스에서 빌드하기

필요한 것: Node.js 20.19 이상, JDK 17, Android SDK (Android Studio 권장)

```bash
npm install                       # postinstall에서 patch-package가 실행돼요
npx expo prebuild --platform android
cd android
./gradlew app:assembleRelease     # Windows: .\gradlew.bat app:assembleRelease
```

결과물: `android/app/build/outputs/apk/release/app-release.apk`

`android/` 폴더는 `app.json` 설정에서 생성되므로 저장소에 포함하지 않습니다.

개발 중에는:

```bash
npx expo run:android   # 개발 빌드 실행
npm run lint
npm run check          # 프로토콜·소켓 자체 검사
```

## 구조

```
src/
  client/chzzk/   치지직 REST·WebSocket 클라이언트, 프로토콜 파싱 (protocol.ts)
  store/          화면 상태(채팅 세션, 즐겨찾기, 설정, 프로필·이모티콘 캐시)
  storage/        SQLite 채팅 기록, MMKV, 보안 저장소
  app/            화면 (expo-router)
  components/     공용 UI
  constants/      디자인 토큰
scripts/          실행 가능한 자체 검사
```

의존 방향은 `client → store → storage → 화면` 한 방향입니다. 자세한 원칙은 [AGENTS.md](AGENTS.md)를 참고하세요.

## 라이선스

[MIT](LICENSE)
