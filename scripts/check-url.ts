import { isNaverUrl, urlHost } from '../src/lib/naver-url';

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`naver-url self-check failed: ${msg}`);
}

const BACKSLASH = String.fromCharCode(92);

assert(isNaverUrl('https://nid.naver.com/nidlogin.login'), 'login page');
assert(isNaverUrl('https://naver.com'), 'apex');
assert(isNaverUrl('https://m.naver.com:443/x?email=a@b.com'), "'@' in query is fine");
assert(!isNaverUrl('https://nid.naver.com:x@evil.example/'), 'userinfo bypass');
assert(!isNaverUrl('https://nid.naver.com@evil.example/'), 'userinfo bypass 2');
assert(!isNaverUrl(`https://evil.example${BACKSLASH}@nid.naver.com/`), 'backslash bypass');
assert(!isNaverUrl('https://nid.naver.com.evil.example/'), 'suffix bypass');
assert(!isNaverUrl('https://evilnaver.com/'), 'lookalike');
assert(!isNaverUrl('http://nid.naver.com/'), 'plain http');
assert(!isNaverUrl('intent://nid.naver.com/#Intent;end'), 'intent scheme');
assert(urlHost('https://nid.naver.com:x@evil.example/') === 'evil.example', 'host after userinfo');
assert(urlHost(`https://evil.example${BACKSLASH}@nid.naver.com/`) === 'evil.example', 'host stops at backslash');
assert(urlHost('https://NID.naver.com:443/a') === 'nid.naver.com', 'host without port');

console.log('naver-url self-check: ok');
