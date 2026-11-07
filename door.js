/* Jinverse 門牌：讀私密 Gist 裡最新的外出網址，自動跳過去。
   這支檔案公開在 GitHub Pages 上，裡面沒有網址、沒有密碼，也沒有 Gist 代號；
   代號放在門牌網址 # 後面，瀏覽器不會把它送到任何伺服器。
   只肯跳到 https://*.trycloudflare.com/m/，Gist 內容就算被亂改也跳不到別的網站。 */
(function (root) {
  'use strict';

  var TUNNEL = /^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/;
  var GIST = /^[0-9a-f]{20,40}$/;
  var FILE = 'door.json';
  var API = 'https://api.github.com/gists/';
  var RAW = 'https://gist.githubusercontent.com/raw/';

  // # 後面：Gist 代號；再加 &go 代表「從主畫面打開」，讀到網址就直接跳。
  // 在 Safari 直接打開（沒有 &go）不跳，讓你有時間按「加入主畫面」。
  function parseHash(hash) {
    var id = String(hash || '').replace(/^#/, '').split('&')[0].trim().toLowerCase();
    return GIST.test(id) ? id : null;
  }

  function wantsGo(hash) {
    return String(hash || '').replace(/^#/, '').split('&').slice(1).indexOf('go') !== -1;
  }

  // door.json → { url, online, updated }；不合規矩就回 null
  function pickTarget(doc) {
    if (!doc || typeof doc !== 'object') return null;
    var base = typeof doc.url === 'string' ? doc.url.trim().replace(/\/+$/, '') : '';
    if (!TUNNEL.test(base)) return null;
    return {
      url: base + '/m/',
      online: doc.state === 'online',
      updated: typeof doc.updated === 'string' ? doc.updated : ''
    };
  }

  function fromApi(json) {
    var f = json && json.files && json.files[FILE];
    if (!f || f.truncated || typeof f.content !== 'string') return null;
    return JSON.parse(f.content);
  }

  function getJson(url) {
    return fetch(url, { cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer' }).then(function (r) {
      if (!r.ok) {
        var err = new Error('HTTP ' + r.status);
        err.status = r.status;
        throw err;
      }
      return r.json();
    });
  }

  // 先問 GitHub API（約 1 分鐘快取）；被限流或失敗時改讀 Gist 原始檔（約 5 分鐘快取）
  function load(id) {
    return getJson(API + id + '?t=' + Date.now()).then(function (json) {
      var doc = fromApi(json);
      if (!doc) throw new Error('Gist 裡沒有 ' + FILE);
      return doc;
    }).catch(function (err) {
      if (err && err.status === 404) throw err;
      return getJson(RAW + id + '/' + FILE + '?t=' + Date.now());
    });
  }

  function when(iso, now) {
    var d = new Date(iso);
    if (!iso || isNaN(d.getTime())) return '';
    var mins = Math.round(((now || Date.now()) - d.getTime()) / 60000);
    var ago = mins < 1 ? '剛剛' : mins < 60 ? mins + ' 分鐘前' : mins < 1440 ? Math.floor(mins / 60) + ' 小時前' : Math.floor(mins / 1440) + ' 天前';
    var stamp = d.toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
    return stamp + '（' + ago + '）';
  }

  function main() {
    var doc = root.document;
    var $ = function (id) { return doc.getElementById(id); };
    function show(title, msg, warn) {
      $('title').textContent = title;
      $('msg').textContent = msg;
      $('msg').className = warn ? 'msg warn' : 'msg';
    }
    function reveal(id) { $(id).hidden = false; }

    $('retry').addEventListener('click', function (e) { e.preventDefault(); root.location.reload(); });
    root.addEventListener('hashchange', function () { root.location.reload(); });

    var id = parseHash(root.location.hash);
    if (!id) {
      show('門牌網址不完整', '網址最後要有「#」和一串代號。請用電腦上閘道視窗印出的門牌網址（也存在 door-url.txt）。', true);
      return;
    }
    $('gist').href = 'https://gist.github.com/' + id;
    var go = wantsGo(root.location.hash) || root.navigator.standalone === true;
    if (!go) {
      // 網址列換成帶 &go 的版本：這時按「加入主畫面」存下的就是會自動跳的網址
      try { root.history.replaceState(null, '', '#' + id + '&go'); } catch (e) { /* 舊瀏覽器就算了 */ }
    }

    load(id).then(function (data) {
      var target = pickTarget(data);
      reveal('retry');
      if (!target) {
        show('還沒有外出網址', '電腦上開 start-mobile-remote.bat，拿到外出網址後門牌會自動更新，再重新整理這一頁。');
        return;
      }
      var stamp = when(target.updated);
      $('go').href = target.url;
      reveal('go');
      if (target.online) {
        if (stamp) { $('when').textContent = '網址更新於 ' + stamp; reveal('when'); }
        if (go) {
          show('正在打開工作室…', '沒有自動跳過去的話，按下面的按鈕。');
          root.location.replace(target.url);
          return;
        }
        show('工作室開著', '按下面的按鈕打開。');
        reveal('hint');
        $('go').addEventListener('click', function (e) { e.preventDefault(); root.location.replace(target.url); });
        return;
      }
      $('go').textContent = '還是打開上次的網址';
      $('go').className = 'btn ghost';
      if (stamp) { $('when').textContent = '閘道關閉於 ' + stamp; reveal('when'); }
      show('電腦上的閘道沒開', '在電腦上開 start-mobile-remote.bat，等視窗印出外出網址後，重新整理這一頁。', true);
    }).catch(function (err) {
      reveal('retry');
      if (err && err.status === 404) {
        show('找不到門牌', '門牌的 Gist 不見了或代號不對。到電腦上執行 start-mobile-remote.bat --door-setup 重新設定。', true);
        return;
      }
      reveal('gist');
      show('讀不到門牌', '網路不穩或 GitHub 暫時沒回應。稍後重新整理，或改看 Gist 上的網址。', true);
    });
  }

  if (typeof module === 'object' && module.exports) {
    module.exports = { parseHash: parseHash, wantsGo: wantsGo, pickTarget: pickTarget, fromApi: fromApi, when: when, TUNNEL: TUNNEL };
  } else if (root.document) {
    main();
  }
})(typeof window !== 'undefined' ? window : globalThis);
