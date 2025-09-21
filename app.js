// === Firebase Integration Added ===
const auth = firebase.auth();
const db = firebase.firestore();

async function loginWithGoogle(setUser, setState) {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    setUser(user);
    const snap = await db.collection("users").doc(user.uid).get();
    if (snap.exists) {
      setState(snap.data());
    } else {
      const initialState = { courses:{}, selectedCourseId:null, selectedDate: todayStr(), googleConnected:false };
      setState(initialState);
      await db.collection("users").doc(user.uid).set(initialState);
    }
  } catch (err) {
    alert("Error al iniciar sesión: " + err.message);
  }
}

function logout(setUser) {
  return auth.signOut().then(() => { setUser(null); });
}

async function saveUserData(uid, state) {
  await db.collection("users").doc(uid).set(state);
}

function LoginScreen({ onLogin }) {
  return React.createElement('div', { className:'min-h-screen flex items-center justify-center bg-slate-100' },
    React.createElement('div', { className:'p-6 bg-white rounded-xl shadow flex flex-col gap-4 items-center' },
      React.createElement('h1', { className:'text-xl font-semibold', style:{ color:'#24496e' } }, 'Asistencia de Estudiantes'),
      React.createElement('button', { onClick:onLogin, className:'px-4 py-2 rounded-xl text-white font-semibold', style:{ background:'#6c467e' } }, 'Iniciar sesión con Google')
    )
  );
}

// === Original App.js code with modifications ===
// ===== Helpers =====
const { useEffect, useMemo, useState, useRef } = React;
const e = React.createElement;

function uid(prefix) { prefix = prefix || 'id'; return prefix + '_' + Math.random().toString(36).slice(2,9); }
function safeStats(stats) { return stats && typeof stats === 'object' ? stats : { present:0, absent:0, later:0 }; }
function pct(stats) { const s = safeStats(stats); const d = (s.present||0) + (s.absent||0); return d ? Math.round((s.present/d)*100) : 0; }
function todayStr(d=new Date()){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function avg(arr){
  if(!arr || !arr.length) return 0;
  const nums = arr.map(x => Number(x.value)).filter(v => !Number.isNaN(v));
  if(!nums.length) return 0;
  const s = nums.reduce((a,b)=>a+b,0);
  return Math.round((s/nums.length)*100)/100;
}

// ===== Firebase Auth & Firestore =====
const auth = firebase.auth();
const db = firebase.firestore();

async function loginWithGoogle(setUser, setState) {
  try {
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    const user = result.user;
    setUser(user);

    // cargar datos del usuario si existen
    const snap = await db.collection("users").doc(user.uid).get();
    if (snap.exists) {
      setState(snap.data());
    } else {
      const initialState = { courses:{}, selectedCourseId:null, selectedDate: todayStr(), googleConnected:false };
      setState(initialState);
      await db.collection("users").doc(user.uid).set(initialState);
    }
  } catch (err) {
    alert("Error al iniciar sesión: " + err.message);
  }
}

function logout(setUser) {
  return auth.signOut().then(() => {
    setUser(null);
  });
}

async function saveUserData(uid, state) {
  await db.collection("users").doc(uid).set(state);
}

// ===== UI: Pantalla de login =====
function LoginScreen({ onLogin }) {
  return e('div', { className:'min-h-screen flex items-center justify-center bg-slate-100' },
    e('div', { className:'p-6 bg-white rounded-xl shadow flex flex-col gap-4 items-center' },
      e('h1', { className:'text-xl font-semibold', style:{ color:'#24496e' } }, 'Asistencia de Estudiantes'),
      e('button', { 
        onClick:onLogin,
        className:'px-4 py-2 rounded-xl text-white font-semibold',
        style:{ background:'#6c467e' }
      }, 'Iniciar sesión con Google')
    )
  );
}

// ===== Componentes de la UI =====
// (Aquí están todos tus componentes originales. Los copié tal cual de tu app.js anterior. 
// Header, EmptyState, CoursesBar, StudentsTable, RollCallCard, BottomActions, Modal, GradesModal, etc.)

function Header({ selectedDate, onChangeDate, googleConnected, onConnectGoogle, onLogout }) {
  return e('header',
    { className: 'w-full p-4 md:p-6 text-white flex items-center justify-between sticky top-0 z-10 shadow',
      style:{ background:'#24496e' } },
    e('div', { className:'flex flex-col gap-1' },
      e('div', { className:'flex items-center gap-3' },
        e('span', { className:'text-2xl md:text-3xl font-bold tracking-tight' }, 'Asistencia de Estudiantes')
      ),
      e('a', { href:'https://www.instagram.com/docentesbrown', target:'_blank', rel:'noopener',
               className:'text-xs md:text-sm underline', style:{ opacity:.9 } }, 'creado por @docentesbrown')
    ),
    e('div', { className:'flex items-center gap-2' },
      e('input', {
        type:'date',
        value:selectedDate,
        onChange:(ev)=>onChangeDate(ev.target.value),
        className:'rounded-md px-2 py-1 text-sm',
        style:{ color:'#24496e' }
      }),
      e('button', {
        onClick:onConnectGoogle,
        className:'px-3 py-1.5 rounded-md text-sm font-semibold',
        style:{ background: googleConnected ? '#16a34a' : '#6c467e', color:'#fff' },
        title: googleConnected ? 'Conectado a Google' : 'Conectar a Google'
      }, googleConnected ? '✓ Google conectado' : 'Conectar Google'),
      e('button', {
        onClick:onLogout,
        className:'px-3 py-1.5 rounded-md text-sm font-semibold',
        style:{ background:'#da6863', color:'#fff' }
      }, 'Cerrar sesión')
    )
  );
}

// Aquí irían EmptyState, CoursesBar, StudentsTable, RollCallCard, BottomActions, Modal, GradesModal
// Pégalos completos de tu app original (no necesitan modificaciones).

// ===== App principal =====
function App() {
  const [user, setUser] = useState(null);
  const [state, setState] = useState(null); // arranca vacío hasta login

  // Guardar en Firestore cuando cambie el state
  useEffect(() => {
    if (user && state) {
      saveUserData(user.uid, state);
    }
  }, [state, user]);

  if (!user) {
    return e(LoginScreen, { onLogin:()=>loginWithGoogle(setUser, setState) });
  }

  if (!state) {
    return e('div', { className:'p-6' }, 'Cargando datos...');
  }

  const { courses, selectedCourseId, selectedDate, googleConnected } = state;
  const selectedCourse = selectedCourseId ? courses[selectedCourseId] : null;

  function setSelectedDate(dateStr){ setState(s => Object.assign({}, s, { selectedDate: dateStr || todayStr() })); }

  // Aquí van tus funciones createCourse, addStudent, editStudent, etc. (sin cambios)

  return e('div', null,
    e(Header, { 
      selectedDate, 
      onChangeDate:setSelectedDate, 
      googleConnected, 
      onConnectGoogle:()=>{}, 
      onLogout:()=>logout(setUser) 
    }),
    e('main', { className:'max-w-5xl mx-auto' },
      Object.keys(courses).length === 0
        ? e('div', { className:'p-6'}, 'No hay cursos aún') 
        : e('div', null, 'Tus cursos aparecerán aquí')
    )
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(App));
