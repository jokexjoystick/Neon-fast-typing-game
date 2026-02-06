/* --- FIREBASE CONFIGURATION --- */
const firebaseConfig = {
  apiKey: "AIzaSyA1L0SwxTlg7kWKckUgzD3tYujJYS2_3RQ",
  authDomain: "neon-typing.firebaseapp.com",
  projectId: "neon-typing",
  storageBucket: "neon-typing.firebasestorage.app",
  messagingSenderId: "1058772257622",
  appId: "1:1058772257622:web:cf739e8c42ae7f110924f7",
  measurementId: "G-Y8KB5FZ15G"
};

let db = null;
try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
} catch (e) { console.log("Offline Mode"); }

/* --- AUDIO ENGINE (SYNTH) --- */
const SFX = {
    ctx: null,
    init: function() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    },
    click: function() { this.init(); this.playTone(800, 'square', 0.05); },
    type: function() { this.init(); this.playTone(600+Math.random()*100, 'triangle', 0.05); },
    error: function() { this.init(); this.playTone(100, 'sawtooth', 0.1); },
    playTone: function(f,t,d) {
        const o=this.ctx.createOscillator(), g=this.ctx.createGain();
        o.type=t; o.frequency.value=f; g.gain.value=0.1;
        o.connect(g); g.connect(this.ctx.destination); o.start(); o.stop(this.ctx.currentTime+d);
    }
};

/* --- PARAGRAPH DATA --- */
const PARAGRAPHS = [
    "Artificial intelligence is the simulation of human intelligence processes by machines, especially computer systems. These processes include learning, reasoning, and self-correction. Particular applications of AI include expert systems, speech recognition, and machine vision.",
    "The Milky Way is the galaxy that contains our Solar System, with the name describing the galaxy's appearance from Earth: a hazy band of light seen in the night sky formed from stars that cannot be individually distinguished by the naked eye. It is estimated to contain 100 to 400 billion stars.",
    "Computer programming is the process of designing and building an executable computer program to accomplish a specific computing result or to perform a specific task. Programming involves tasks such as analysis, generating algorithms, profiling algorithms' accuracy and resource consumption, and the implementation of algorithms.",
    "Quantum mechanics is a fundamental theory in physics that provides a description of the physical properties of nature at the scale of atoms and subatomic particles. It is the foundation of all quantum physics including quantum chemistry, quantum field theory, quantum technology, and quantum information science.",
    "The Internet is a global system of interconnected computer networks that uses the Internet protocol suite to communicate between networks and devices. It is a network of networks that consists of private, public, academic, business, and government networks of local to global scope."
];

/* --- APP LOGIC --- */
const APP = {
    user: "PLAYER", country: "🇮🇳", stats: {best:0, games:0},
    currentLBType: 'paragraph',

    toggleMenu: function() {
        const menu = document.getElementById('side-menu');
        const overlay = document.getElementById('nav-overlay');
        const isOpen = menu.classList.contains('open');
        if(isOpen) { menu.classList.remove('open'); overlay.classList.remove('active'); } 
        else { menu.classList.add('open'); overlay.classList.add('active'); }
    },
    closeMenu: function() {
        document.getElementById('side-menu').classList.remove('open');
        document.getElementById('nav-overlay').classList.remove('active');
    },

    login: function() {
        const u = document.getElementById('login-user').value.trim().toUpperCase();
        const c = document.getElementById('login-country').value;
        if(u.length < 2) return alert("ENTER ID");
        this.startSession(u, c);
    },
    playAsGuest: function() {
        this.startSession("GUEST-" + Math.floor(Math.random()*9000), "🌍");
    },
    startSession: function(u, c) {
        this.user = u; this.country = c;
        const local = JSON.parse(localStorage.getItem('nt_9_'+u)) || {best:0, games:0};
        this.stats = local;
        this.updateUI();
        this.showGame();
    },
    updateUI: function() {
        document.getElementById('hud-username').textContent = this.user;
        document.getElementById('hud-flag').textContent = this.country;
        document.getElementById('profile-name').textContent = this.user;
        document.getElementById('profile-flag-large').textContent = this.country;
        document.getElementById('profile-best').textContent = this.stats.best;
        document.getElementById('profile-games').textContent = this.stats.games;
    },
    saveStats: function(wpm) {
        this.stats.games++; if(wpm > this.stats.best) this.stats.best = wpm;
        localStorage.setItem('nt_9_'+this.user, JSON.stringify(this.stats));
        this.updateUI();
    },

    showGame: function() { 
        this.closeMenu(); GAME.mode = 'ranked';
        document.body.classList.remove('lite-mode');
        document.getElementById('ranked-controls').style.display = 'flex';
        document.getElementById('practice-controls').style.display = 'none';
        switchScreen('screen-game'); GAME.reset();
    },
    showPracticeSetup: function() { this.closeMenu(); switchScreen('screen-practice-setup'); },
    fillPracticeText: function() {
        const p = PARAGRAPHS[Math.floor(Math.random()*PARAGRAPHS.length)];
        document.getElementById('practice-text').value = p;
    },
    startPractice: function() {
        const t = parseInt(document.getElementById('practice-time').value) || 60;
        const txt = document.getElementById('practice-text').value.trim();
        GAME.mode = 'practice'; GAME.customTime = t; GAME.customText = txt;
        document.body.classList.add('lite-mode');
        document.getElementById('ranked-controls').style.display = 'none';
        document.getElementById('practice-controls').style.display = 'flex';
        switchScreen('screen-game'); GAME.reset();
    },
    showProfile: function() { this.closeMenu(); switchScreen('screen-profile'); },
    
    // Leaderboard Switcher
    showLeaderboard: function() { 
        this.closeMenu(); 
        switchScreen('screen-leaderboard'); 
        this.switchLB('paragraph', document.querySelector('.tab-btn')); 
    },
    switchLB: function(type, btn) {
        this.currentLBType = type;
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        fetchLB(type);
    }
};

function switchScreen(id) {
    document.querySelectorAll('section').forEach(s=>s.classList.remove('active-screen'));
    document.getElementById(id).classList.add('active-screen');
}

function fetchLB(type) {
    const list = document.getElementById('lb-content');
    const podium = document.getElementById('podium-area');
    if(!db) return list.innerHTML = "OFFLINE MODE";
    list.innerHTML = "FETCHING " + type.toUpperCase() + "..."; podium.innerHTML = "";
    
    db.ref('scores/' + type).orderByChild('wpm').limitToLast(20).once('value', s => {
        list.innerHTML = ""; const d = []; s.forEach(c => d.push(c.val()));
        const ranked = d.reverse();
        
        let pHTML = "";
        if(ranked[1]) pHTML += createPodium(ranked[1], 2);
        if(ranked[0]) pHTML += createPodium(ranked[0], 1);
        if(ranked[2]) pHTML += createPodium(ranked[2], 3);
        podium.innerHTML = pHTML;

        ranked.forEach((r, i) => {
            let color = i===0?"var(--neon-gold)":i===1?"var(--neon-silver)":i===2?"var(--neon-bronze)":"var(--text-color)";
            let trophy = i===0?"🏆":i===1?"🥈":i===2?"🥉":"";
            list.innerHTML += `<div class="lb-row"><span style="color:${color};font-weight:bold">#${i+1} ${trophy}</span><span>${r.country} ${r.user}</span><span style="color:var(--neon-green)">${r.wpm}</span></div>`;
            if(r.user === APP.user && i < 3 && type === 'paragraph') document.getElementById('profile-trophy').innerHTML = trophy + " TOP RATED";
        });
        
        if(ranked.length === 0) list.innerHTML = "NO DATA FOR THIS CATEGORY YET";
    });
}
function createPodium(d, r) {
    let cls = r===1?"p-1":r===2?"p-2":"p-3";
    return `<div class="podium-place ${cls}"><div class="p-flag">${d.country}</div><div class="p-bar">${d.wpm}</div><div class="p-name">${d.user}</div></div>`;
}

/* --- GAME ENGINE --- */
const WORDS = {
    easy: "Neon Wave Grid Core Link Node Hack Flow Data Bit Byte Run Void Null Zero One Code Key Sync Ping Load Save Edit File",
    medium: "System Matrix Vector Pixel Laser Cyber Neural Logic Proxy Server Client Script Binary Router Buffer Access Memory Render Shader Syntax",
    hard: "Encryption Mainframe Protocol Bandwidth Algorithm Processor Interface Recursive Heuristic Firewall Checksum Throughput Latency Quantum Asynchronous"
};

const GAME = {
    mode: 'ranked', active: false, words: [], idx: 0, timer: null, timeLeft: 60, timeMax: 60, correct:0, total:0, customTime: 60, customText: "",
    el: { stage: document.getElementById('words-wrapper'), input: document.getElementById('mobile-input') },

    init: function() {
        this.el.input.addEventListener('input', e => this.handle(e));
        document.getElementById('text-container').addEventListener('click', () => this.el.input.focus());
        const kb=document.getElementById('visual-keyboard');
        if(kb && kb.innerHTML === "") {
            ["qwertyuiop","asdfghjkl","zxcvbnm"].forEach((r,ri)=>{
                r.split('').forEach((k,i)=>{ kb.innerHTML+=`<div class="key" data-k="${k}" style="left:${i*40+ri*20+100}px; top:${ri*45}px">${k}</div>`; });
            });
        }
    },

    reset: function() {
        this.active=false; clearInterval(this.timer);
        document.getElementById('modal-overlay').style.display='none';
        
        if(this.mode === 'practice') {
            this.timeMax = this.customTime;
            if(this.customText.length > 0) {
                this.words = this.customText.split(/\s+/).filter(w => w.length > 0);
            } else {
                const para = PARAGRAPHS[Math.floor(Math.random() * PARAGRAPHS.length)];
                this.words = para.split(/\s+/);
            }
        } else {
            const diff = document.getElementById('diff-select').value;
            this.timeMax = parseInt(document.getElementById('time-select').value);
            
            if(diff === 'paragraph') {
                const para = PARAGRAPHS[Math.floor(Math.random() * PARAGRAPHS.length)];
                this.words = para.split(/\s+/);
            } else {
                const pool = WORDS[diff].split(' ');
                this.words = Array(60).fill().map(() => pool[Math.floor(Math.random()*pool.length)]);
            }
        }

        this.timeLeft = this.timeMax;
        this.idx=0; this.correct=0; this.total=0;
        document.getElementById('time-display').textContent=this.timeLeft;
        document.getElementById('progress-ring').style.strokeDashoffset=0;
        this.el.input.value='';
        document.getElementById('text-container').scrollTop = 0;
        
        this.el.stage.innerHTML = "";
        this.words.forEach(w => {
            const d=document.createElement('div'); d.className='word';
            w.split('').forEach(c=>{ d.innerHTML += `<span class="char">${c}</span>`; });
            this.el.stage.appendChild(d);
        });
        this.moveCursor();
    },

    handle: function(e) {
        if(this.timeLeft<=0) return this.el.input.value='';
        if(!this.active && this.el.input.value.length>0) this.start();
        const val = this.el.input.value;
        if(val.endsWith(' ')) { this.triggerWave(val.trim()); this.el.input.value=''; }
        else { this.checkWord(val); }
    },

    start: function() {
        this.active = true;
        this.timer = setInterval(() => {
            this.timeLeft--; document.getElementById('time-display').textContent = this.timeLeft;
            const pct = (this.timeLeft/this.timeMax)*339;
            document.getElementById('progress-ring').style.strokeDashoffset = 339 - pct;
            if(this.timeLeft<=0) this.end();
        }, 1000);
    },

    checkWord: function(val) {
        const wEl = this.el.stage.children[this.idx];
        const tgt = this.words[this.idx];
        SFX.type(); this.hlKey(val.slice(-1));
        Array.from(wEl.children).forEach((c, i) => {
            const l = val[i]; c.className = 'char';
            if(!l) return;
            if(l === tgt[i]) c.classList.add('correct');
            else { c.classList.add('wrong'); if(i===val.length-1) SFX.error(); }
        });
        this.moveCursor(wEl, val.length);
    },

    triggerWave: function(val) {
        const wEl = this.el.stage.children[this.idx];
        const tgt = this.words[this.idx];
        const isCorrect = (val === tgt);
        const timerBox = document.getElementById('timer-box');
        const wave = document.createElement('div');
        wave.className = isCorrect ? 'energy-wave wave-correct' : 'energy-wave wave-wrong';
        timerBox.appendChild(wave);
        setTimeout(() => wave.remove(), 500);
        
        if(isCorrect) { this.correct++; } else { SFX.error(); wEl.classList.add('wrong'); }
        this.total++; this.idx++; this.moveCursor();
        if(wEl.offsetTop > document.getElementById('text-container').scrollTop + 80) {
            document.getElementById('text-container').scrollTop = wEl.offsetTop - 20;
        }
        const m = (this.timeMax-this.timeLeft)/60;
        const wpm = m>0 ? Math.round(this.correct/m) : 0;
        document.getElementById('wpm').textContent = wpm;
    },

    moveCursor: function(wEl, cIdx=0) {
        if(!wEl) wEl = this.el.stage.children[this.idx];
        if(!wEl) return;
        const char = wEl.children[cIdx];
        let t, l;
        if(char) { t=char.offsetTop; l=char.offsetLeft; }
        else { t=wEl.offsetTop; l=wEl.offsetLeft + wEl.offsetWidth; }
        document.getElementById('cursor').style.transform = `translate(${l}px, ${t+5}px)`;
    },

    hlKey: function(k) {
        const key=document.querySelector(`.key[data-k="${k}"]`);
        if(key){ key.classList.add('active'); setTimeout(()=>key.classList.remove('active'),150); }
    },

    end: function() {
        this.active = false; clearInterval(this.timer);
        const wpm = parseInt(document.getElementById('wpm').textContent);
        const acc = Math.round((this.correct/Math.max(this.total,1))*100);
        document.getElementById('final-wpm').textContent = wpm;
        document.getElementById('final-acc').textContent = acc+"%";
        document.getElementById('modal-overlay').style.display='flex';
        
        if(this.mode === 'practice') {
            document.getElementById('modal-title').textContent = "PRACTICE ENDED";
            document.getElementById('modal-msg').textContent = "Result not saved.";
        } else {
            document.getElementById('modal-title').textContent = "MISSION COMPLETE";
            document.getElementById('modal-msg').textContent = "Data uploaded.";
            APP.saveStats(wpm);
            if(db && wpm > 0) { 
                const diff = document.getElementById('diff-select').value;
                db.ref('scores/' + diff).push({ user: APP.user, country: APP.country, wpm: wpm, date: new Date().toLocaleDateString() }); 
            }
        }
    }
};

GAME.init();
      
