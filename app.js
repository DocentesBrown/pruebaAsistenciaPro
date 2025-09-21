// ===== Helpers =====
const { useEffect, useMemo, useState, useRef } = React;
const e = React.createElement;

const LS_KEY = 'agenda_estudiantes_sin_google_v4';
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
function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    const base = { courses:{}, selectedCourseId:null, selectedDate: todayStr() };
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return {
      courses: parsed.courses || {},
      selectedCourseId: parsed.selectedCourseId || null,
      selectedDate: todayStr()
    };
  } catch {
    return { courses:{}, selectedCourseId:null, selectedDate: todayStr() };
  }
}
function saveState(state){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

// ===== Autenticación Firebase =====
function signInWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  return firebase.auth().signInWithPopup(provider)
    .catch(err => alert("Error al iniciar sesión: " + err.message));
}

function signOutGoogle() {
  return firebase.auth().signOut()
    .catch(err => alert("Error al cerrar sesión: " + err.message));
}

// ===== UI =====

function Header({ selectedDate, onChangeDate }) {
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
      e('label', { className:'text-sm opacity-90 hidden md:block' }, 'Fecha:'),
      e('input', { type:'date', value:selectedDate,
        onChange:(ev)=>onChangeDate(ev.target.value),
        className:'rounded-md px-2 py-1 text-sm', style:{ color:'#24496e' } })
    )
  );
}

function EmptyState({ onCreateCourse }) {
  return e('div', { className:'p-6 md:p-10 text-center' },
    e('h2', { className:'text-xl md:text-2xl font-semibold mb-2', style:{ color:'#24496e' } }, 'No hay cursos aún'),
    e('p', { className:'text-slate-700 mb-4' }, 'Creá tu primer curso para comenzar.'),
    e('button', { onClick:onCreateCourse, className:'px-4 py-2 rounded-2xl text-white shadow', style:{ background:'#6c467e' } }, '+ Nuevo curso')
  );
}

function CoursesBar({ courses, selectedCourseId, onSelect, onCreate, onRename, onDelete }) {
  const [renamingId, setRenamingId] = useState(null);
  const [newName, setNewName]   = useState('');
  return e('div', { className:'w-full overflow-x-auto border-b border-slate-300 bg-white' },
    e('div', { className:'flex items-center gap-2 p-3 min-w-max' },
      ...Object.values(courses).map((c) =>
        e('div', { key:c.id, className:'flex items-center gap-2 px-3 py-2 rounded-2xl border',
          style: selectedCourseId===c.id ? { borderColor:'#24496e', background:'#f0f4f8' } : { borderColor:'#d7dbe0' } },
          renamingId===c.id
            ? e('input', { autoFocus:true, value:newName, onChange:(ev)=>setNewName(ev.target.value),
                onBlur:()=>{ onRename(c.id, newName || c.name); setRenamingId(null); },
                onKeyDown:(ev)=>{ if(ev.key==='Enter'){ onRename(c.id, newName||c.name); setRenamingId(null); } if(ev.key==='Escape'){ setRenamingId(null); } },
                className:'px-2 py-1 text-sm border rounded', style:{ borderColor:'#d7dbe0' } })
            : e('button', { className:'text-sm font-medium', style:{ color: selectedCourseId===c.id ? '#24496e' : '#334155' }, onClick:()=>onSelect(c.id) }, c.name),
          e('div', { className:'flex items-center gap-1' },
            e('button', { title:'Renombrar', onClick:()=>{ setRenamingId(c.id); setNewName(c.name); },
              className:'text-xs px-2 py-1 rounded', style:{ background:'#f3efdc', color:'#24496e' } }, '✎'),
            e('button', { title:'Eliminar curso', onClick:()=>onDelete(c.id),
              className:'text-xs px-2 py-1 rounded', style:{ background:'#fde2e0', color:'#da6863' } }, '🗑')
          )
        )
      ),
      e('button', { onClick:onCreate, className:'px-3 py-2 rounded-2xl text-sm', style:{ background:'#f3efdc', color:'#24496e' } }, '+ Nuevo curso')
    )
  );
}

function StudentsTable({ students, onAdd, onEdit, onDelete, onShowAbsences, onOpenGrades }) {
  const [cond, setCond] = useState('cursa');
  const [name, setName] = useState('');
  const sorted = useMemo(() => Object.values(students).sort((a,b)=>a.name.localeCompare(b.name)), [students]);
  return e('div', { className:'p-4 md:p-6' },
    e('div', { className:'flex flex-col md:flex-row gap-2 md:items-end mb-4' },
      e('div', { className:'flex-1' },
        e('label', { className:'block text-sm font-medium mb-1', style:{ color:'#24496e' } }, 'Agregar estudiante'),
        e('input', { placeholder:'Nombre y apellido', value:name, onChange:(ev)=>setName(ev.target.value),
          className:'w-full max-w-md px-3 py-2 border rounded-xl', style:{ borderColor:'#d7dbe0' } })
      ),
      e('div', { className:'flex items-center gap-2' },
        e('select', { value:cond, onChange:(ev)=>setCond(ev.target.value), className:'px-3 py-2 border rounded-xl', style:{ borderColor:'#d7dbe0' } },
          e('option', {value:'cursa'}, 'Cursa'),
          e('option', {value:'recursa'}, 'Recursa')
        )
      ),
      e('button', { onClick:()=>{ if(!name.trim()) return; onAdd(name.trim(), cond); setName(''); },
        className:'px-4 py-2 rounded-xl text-white', style:{ background:'#6c467e' } }, '+ Agregar')
    ),
    e('div', { className:'overflow-x-auto' },
      e('table', { className:'w-full text-left border rounded-xl overflow-hidden', style:{ borderColor:'#cbd5e1' } },
        e('thead', { style:{ background:'#24496e', color:'#ffffff' } },
          e('tr', null,
            e('th', { className:'p-3 text-sm' }, 'Estudiante'),
            e('th', { className:'p-3 text-sm' }, '% Asistencia'),
            e('th', { className:'p-3 text-sm' }, 'Presente'),
            e('th', { className:'p-3 text-sm' }, 'Ausente'),
            e('th', { className:'p-3 text-sm' }, 'Promedio'),
            e('th', { className:'p-3 text-sm' })
          )
        ),
        e('tbody', null,
          ...(sorted.length
            ? sorted.map((s, idx) => {
                const st = safeStats(s.stats);
                const rowBg = idx % 2 === 0 ? '#ffffff' : '#f3efdc';
                const promedio = avg(s.grades||[]);
                return e('tr', { key:s.id, style:{ background:rowBg, borderTop:'1px solid #cbd5e1' } },
                  e('td', { className:'p-3' },
                    e('div', { className:'flex items-center gap-2' },
                      e('span', { className:'font-medium' }, s.name),
                      (s.condition ? e('span', { className:'text-[10px] px-2 py-0.5 rounded-full',
                        style:{ background: s.condition==='recursa' ? '#fde2e0' : '#e8f7ef', color: s.condition==='recursa' ? '#da6863' : '#166534' } },
                        s.condition==='recursa' ? 'Recursa' : 'Cursa') : null),
                      e('button', { onClick:()=>{
                          const nuevo = prompt('Editar nombre', s.name) || s.name;
                          const cond = prompt('Condición (cursa/recursa)', s.condition || 'cursa') || (s.condition || 'cursa');
                          const norm = (cond||'').toLowerCase()==='recursa' ? 'recursa' : 'cursa';
                          onEdit(s.id, { name: nuevo.trim(), condition: norm });
                        },
                        className:'text-xs px-2 py-1 rounded', style:{ background:'#f3efdc', color:'#24496e' } }, 'Editar')
                    )
                  ),
                  e('td', { className:'p-3 font-semibold', style:{ color:'#24496e' } }, pct(st) + '%'),
                  e('td', { className:'p-3' }, st.present || 0),
                  e('td', { className:'p-3' },
                    e('div', { className:'flex items-center gap-2' },
                      e('span', null, st.absent || 0),
                      e('button', { onClick:()=>onShowAbsences(s), className:'text-xs px-2 py-1 rounded',
                        style:{ background:'#f3efdc', color:'#24496e' } }, 'Fechas')
                    )
                  ),
                  e('td', { className:'p-3 font-semibold', style:{ color:'#24496e' } }, promedio.toFixed(2)),
                  e('td', { className:'p-3 text-right' },
                    e('div', {className:'flex gap-2 justify-end'},
                      e('button', { onClick:()=>onOpenGrades(s), className:'text-xs px-3 py-1 rounded',
                        style:{ background:'#f0eaf5', color:'#6c467e' } }, 'Notas'),
                      e('button', { onClick:()=>{ if(confirm('¿Eliminar estudiante y sus datos?')) onDelete(s.id); },
                        className:'text-xs px-3 py-1 rounded', style:{ background:'#fde2e0', color:'#da6863' } }, 'Eliminar')
                    )
                  )
                );
              })
            : [e('tr', { key:'empty' }, e('td', { colSpan:6, className:'p-4 text-center text-slate-500' }, 'Sin estudiantes.'))]
          )
        )
      )
    )
  );
}

function RollCallCard({ students, onMark, onUndo, selectedDate }) {
  const [order, setOrder] = useState(students.map(s => s.id));
  const [index, setIndex] = useState(0);
  const [ops, setOps] = useState([]);

  useEffect(() => { setOrder(students.map(s => s.id)); setIndex(0); setOps([]); }, [students.map(s => s.id).join('|')]);

  const currentId = order[index];
  const current = students.find(s => s.id === currentId) || null;

  function handleAction(action){
    if(!current) return;
    onMark(current.id, action, selectedDate);
    if (action === 'later') {
      const from = index;
      const newOrder = order.slice();
      const [m] = newOrder.splice(from, 1);
      newOrder.push(m);
      setOrder(newOrder);
      setOps(ops => ops.concat([{ id: current.id, action, type:'mark', fromIndex: from, toIndex: newOrder.length - 1 }]));
      return;
    }
    const from = index;
    setOps(ops => ops.concat([{ id: current.id, action, type:'mark', fromIndex: from, toIndex: from }]));
    setIndex(i => Math.min(i + 1, order.length));
  }

  function goBack(){
    if (ops.length === 0) return;
    const last = ops[ops.length - 1];
    onUndo(last.id, last.action, selectedDate);
    if (last.action === 'later' && typeof last.fromIndex === 'number' && typeof last.toIndex === 'number') {
      const newOrder = order.slice();
      const [m] = newOrder.splice(last.toIndex, 1);
      newOrder.splice(last.fromIndex, 0, m);
      setOrder(newOrder);
      setIndex(last.fromIndex);
    } else {
      setIndex(i => Math.max(0, i - 1));
    }
    setOps(arr => arr.slice(0, -1));
  }

  if (!students.length) return e('div', { className:'p-6 text-center text-slate-600' }, 'No hay estudiantes en este curso.');

  const cardPos = Math.min(index + 1, order.length);
  return e('div', { className:'p-4 md:p-6' },
    e('div', { className:'max-w-xl mx-auto' },
      e('div', { className:'mb-3 text-sm text-slate-600 text-center' }, `Tarjeta ${cardPos} / ${order.length}`),
      current
        ? e('div', { className:'rounded-3xl border shadow p-6 md:p-8 bg-white', style:{ borderColor:'#d7dbe0' } },
            e('div', { className:'text-center mb-6' },
              e('div', { className:'text-2xl md:4xl font-bold tracking-tight mb-2', style:{ color:'#24496e' } }, current.name),
              e('div', { className:'text-sm md:text-base text-slate-700' }, 'Asistencia acumulada: ',
                e('span', { className:'font-semibold', style:{ color:'#24496e' } }, pct(current.stats) + '%'),
                ' · Fecha sesión: ', e('span', { className:'font-semibold', style:{ color:'#24496e' } }, selectedDate)
              )
            ),
            e('div', { className:'grid grid-cols-2 gap-3 md:gap-4' },
              e('button', { onClick:()=>handleAction('present'), className:'py-3 md:py-4 rounded-2xl font-semibold border',
                style:{ background:'#e8f7ef', borderColor:'#cdebdc', color:'#166534' } }, 'Presente ✅'),
              e('button', { onClick:()=>handleAction('absent'), className:'py-3 md:py-4 rounded-2xl font-semibold border',
                style:{ background:'#fdecea', borderColor:'#f7d7d3', color:'#991b1b' } }, 'Ausente ❌'),
              e('button', { onClick:()=>handleAction('later'), className:'py-3 md:py-4 rounded-2xl font-semibold border col-span-2',
                style:{ background:'#f0eaf5', borderColor:'#e2d7ec', color:'#6c467e' } }, 'Revisar más tarde ⏳'),
              e('button', { onClick:goBack, className:'py-2 md:py-2.5 rounded-xl font-medium col-span-2',
                style:{ background:'#f3efdc', color:'#24496e' } }, '← Volver al anterior (deshacer)')
            )
          )
        : e('div', { className:'rounded-3xl border shadow p-6 md:p-8 bg-white text-center', style:{ borderColor:'#d7dbe0' } },
            e('div', { className:'text-xl font-semibold mb-2', style:{ color:'#24496e' } }, '¡Lista completada!'),
            e('div', { className:'text-slate-700' }, 'Ya asignaste estado a todos.')
          )
    )
  );
}

// Acciones inferiores
function BottomActions({ onExportJSON, onImportJSON, onExportXLSX }) {
  const fileRef = useRef(null);
  function handleFile(ev){
    const file = ev.target.files && ev.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { onImportJSON(reader.result); } finally { ev.target.value=''; } };
    reader.readAsText(file);
  }
  return e('div', { className:'p-4 md:p-6 sticky bottom-0 bg-white border-t shadow-sm', style:{ borderColor:'#d7dbe0' } },
    e('div', { className:'max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3' },
      e('button', { onClick:onExportXLSX, className:'px-4 py-2 rounded-xl text-white font-semibold', style:{ background:'#24496e' } }, 'Exportar .xlsx'),
      e('button', { onClick:onExportJSON, className:'px-4 py-2 rounded-xl font-semibold', style:{ background:'#f3efdc', color:'#24496e' } }, 'Exportar JSON'),
      e('button', { onClick:()=> (fileRef.current && fileRef.current.click()), className:'px-4 py-2 rounded-xl font-semibold', style:{ background:'#f3efdc', color:'#24496e' } }, 'Importar JSON'),
      e('input', { ref:fileRef, type:'file', accept:'.json,application/json', className:'hidden', onChange:handleFile })
    )
  );
}

// Modal base
function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return e('div', { className:'fixed inset-0 z-50 flex items-end sm:items-center justify-center' },
    e('div', { className:'absolute inset-0', onClick:onClose, style:{ background:'rgba(0,0,0,.4)' } }),
    e('div', { className:'relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-lg p-4 sm:p-6 m-0 sm:m-4', style:{ background:'#ffffff', border:'1px solid #d7dbe0' } },
      e('div', { className:'flex items-center justify-between mb-3' },
        e('h3', { className:'text-lg font-semibold', style:{ color:'#24496e' } }, title),
        e('button', { onClick:onClose, className:'px-2 py-1 rounded', style:{ background:'#f3efdc', color:'#24496e' } }, '✕')
      ),
      e('div', null, children)
    )
  );
}

// Modal de calificaciones (sin descripción)
function GradesModal({ open, student, onClose, onAdd, onEdit, onDelete }) {
  const [tipo, setTipo] = useState('escrito');
  const [date, setDate] = useState(todayStr());
  const [value, setValue] = useState('');
  useEffect(() => { if (open) { setTipo('escrito'); setDate(todayStr()); setValue(''); } }, [open]);
  if(!open || !student) return null;

  const grades = (student.grades||[]).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const promedio = avg(grades);

  return e(Modal, { open, title:`Calificaciones – ${student.name}`, onClose },
    e('div', { className:'space-y-4' },
      e('div', { className:'grid grid-cols-1 sm:grid-cols-3 gap-2' },
        e('input', { type:'date', className:'px-3 py-2 border rounded-xl', style:{borderColor:'#d7dbe0'},
          value:date, onChange:(ev)=>setDate(ev.target.value)}),
        e('select', { value:tipo, onChange:(ev)=>setTipo(ev.target.value), className:'px-3 py-2 border rounded-xl', style:{borderColor:'#d7dbe0'} },
          e('option', {value:'escrito'}, 'Escrito'),
          e('option', {value:'oral'}, 'Oral'),
          e('option', {value:'practico'}, 'Práctico'),
          e('option', {value:'conceptual'}, 'Conceptual')
        ),
        e('input', { type:'number', step:'0.01', className:'px-3 py-2 border rounded-xl', style:{borderColor:'#d7dbe0'},
          placeholder:'Nota', value:value, onChange:(ev)=>setValue(ev.target.value)}),
      ),
      e('div', null,
        e('button', { onClick:()=>{
            const v = Number(value);
            if(Number.isNaN(v)) { alert('Ingresá una nota numérica.'); return; }
            onAdd({ id: uid('nota'), tipo, date: date || todayStr(), value: v });
            setValue('');
          },
          className:'px-4 py-2 rounded-xl text-white', style:{background:'#6c467e'}
        }, '+ Agregar nota')
      ),
      e('div', { className:'text-sm text-slate-700' }, `Promedio: `, e('strong', {style:{color:'#24496e'}}, promedio.toFixed(2))),
      e('div', { className:'max-h-64 overflow-auto border rounded-xl', style:{borderColor:'#d7dbe0'} },
        e('table', { className:'w-full text-left' },
          e('thead', { style:{background:'#24496e', color:'#fff'} },
            e('tr', null,
              e('th', {className:'p-2 text-sm'}, 'Fecha'),
              e('th', {className:'p-2 text-sm'}, 'Tipo'),
              e('th', {className:'p-2 text-sm'}, 'Nota'),
              e('th', {className:'p-2 text-sm'})
            )
          ),
          e('tbody', null,
            ...(grades.length ? grades.map(g =>
              e('tr', {key:g.id, className:'border-t', style:{borderColor:'#e2e8f0'}},
                e('td', {className:'p-2'}, g.date || ''),
                e('td', {className:'p-2'}, (g.tipo ? (g.tipo.charAt(0).toUpperCase()+g.tipo.slice(1)) : '')),
                e('td', {className:'p-2'}, String(g.value)),
                e('td', {className:'p-2 text-right'},
                  e('button', { className:'text-xs px-2 py-1 rounded mr-2', style:{background:'#f3efdc', color:'#24496e'},
                    onClick:()=>{
                      const newDate = prompt('Editar fecha (YYYY-MM-DD)', g.date || todayStr()) ?? g.date;
                      const newTipo = prompt('Editar tipo (escrito/oral/practico/conceptual)', g.tipo || 'escrito') ?? g.tipo;
                      const newValueRaw = prompt('Editar nota', String(g.value));
                      const nv = Number(newValueRaw);
                      if(Number.isNaN(nv)) return;
                      onEdit({ ...g, date:newDate, tipo:newTipo, value:nv });
                    }
                  }, 'Editar'),
                  e('button', { className:'text-xs px-2 py-1 rounded', style:{background:'#fde2e0', color:'#da6863'},
                    onClick:()=>onDelete(g.id)
                  }, 'Eliminar')
                )
              )
            ) : [e('tr', {key:'empty'}, e('td', {colSpan:4, className:'p-2 text-center text-slate-500'}, 'Sin notas todavía.'))])
          )
        )
      )
    )
  );
}

// Modal de inasistencias: incluye ausentes y tarde; select de motivo + aplicar
function AbsencesModal({ open, student, onClose, onApplyChange }) {
  const [choices, setChoices] = useState({}); // histId -> reason
  useEffect(()=>{ setChoices({}); }, [open, student && student.id]);

  if(!open || !student) return null;
  const history = (student.history || []).map(h => h.id ? h : Object.assign({}, h, { id: uid('hist') }));
  const rows = history
    .filter(h => h.status === 'absent' || h.status === 'tarde')
    .slice()
    .sort((a,b)=>(a.date||'').localeCompare(b.date||''));

  // Conteo: solo cuentan los 'absent' (justificada sigue contando)
  const totalAusentes = rows.filter(r => r.status === 'absent').length;

  function labelFor(r){
    if(r.status === 'tarde') return 'Tarde';
    if(r.status === 'absent' && r.reason === 'justificada') return 'Justificada';
    return 'Ausente';
    }

  return e(Modal, { open, title:`Inasistencias – ${student.name}`, onClose },
    e('div', null,
      e('div', { className:'mb-3 text-sm text-slate-700' },
        'Total de ausencias: ',
        e('strong', {style:{color:'#24496e'}}, totalAusentes)
      ),
      e('div', { className:'max-h-72 overflow-auto border rounded-xl', style:{borderColor:'#d7dbe0'} },
        e('table', { className:'w-full text-left' },
          e('thead', { style:{background:'#24496e', color:'#fff'} },
            e('tr', null,
              e('th', {className:'p-2 text-sm'}, 'Fecha'),
              e('th', {className:'p-2 text-sm'}, 'Estado'),
              e('th', {className:'p-2 text-sm'}, 'Cambiar a'),
              e('th', {className:'p-2 text-sm'})
            )
          ),
          e('tbody', null,
            ...(rows.length ? rows.map((r) =>
              e('tr', { key:r.id, className:'border-t', style:{borderColor:'#e2e8f0'} },
                e('td', { className:'p-2' }, r.date || ''),
                e('td', { className:'p-2' }, labelFor(r)),
                e('td', { className:'p-2' },
                  e('select', {
                    className:'px-2 py-1 border rounded', style:{borderColor:'#d7dbe0'},
                    value:choices[r.id] || '',
                    onChange:(ev)=> setChoices(ch => Object.assign({}, ch, { [r.id]: ev.target.value }))
                  },
                    e('option', {value:''}, 'Seleccionar...'),
                    e('option', {value:'tarde'}, 'Tarde'),
                    e('option', {value:'justificada'}, 'Justificada'),
                    e('option', {value:'erronea'}, 'Errónea (eliminar)')
                  )
                ),
                e('td', { className:'p-2 text-right' },
                  e('button', {
                    className:'text-xs px-2 py-1 rounded',
                    style:{background:'#fde2e0', color:'#da6863'},
                    onClick:()=>{
                      const ch = choices[r.id];
                      if(!ch){ alert('Elegí una opción en "Cambiar a".'); return; }
                      onApplyChange(r.id, ch);
                    }
                  }, 'Aplicar')
                )
              )
            ) : [e('tr', { key:'empty' }, e('td', { colSpan:4, className:'p-2 text-center text-slate-500' }, 'Sin registros.'))])
          )
        )
      )
    )
  );
}

function App() {
  const [state, setState] = useState(loadState());
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Escuchar cambios de sesión
  useEffect(() => {
    const unsub = firebase.auth().onAuthStateChanged(async (u) => {
      if (u) {
        setUser(u);
        const doc = await db.collection("users").doc(u.uid).get();
        if (doc.exists) {
          setState(doc.data());
        } else {
          const local = loadState();
          await db.collection("users").doc(u.uid).set(local);
          setState(local);
        }
      } else {
        setUser(null);
        setState(loadState());
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Guardar cambios
  useEffect(() => {
    if (!loading) {
      if (user) {
        db.collection("users").doc(user.uid).set(state);
      } else {
        saveState(state);
      }
    }
  }, [state, user, loading]);

  // Pantalla de carga
  if (loading) {
    return e('div', { className:'h-screen flex items-center justify-center' },
      e('p', { className:'text-lg text-slate-600' }, 'Cargando...')
    );
  }

  // Pantalla de login si no hay usuario
  if (!user) {
    return e('div', { className:'h-screen flex items-center justify-center bg-slate-100' },
      e('div', { className:'p-8 bg-white rounded-2xl shadow-lg text-center space-y-6' },
        e('h1', { className:'text-2xl font-bold text-slate-800' }, 'Asistencia de Estudiantes'),
        e('p', { className:'text-slate-600' }, 'Iniciá sesión con Google para continuar'),
        e('button', {
          onClick: signInWithGoogle,
          className:'px-5 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl font-semibold'
        }, 'Iniciar sesión con Google')
      )
    );
  }

  // Si hay usuario → mostrar la app normal
  return e('div', null,
    e(Header, { selectedDate, onChangeDate:setSelectedDate, user, onLogin:signInWithGoogle, onLogout:signOutGoogle }),
  );

  // Modal de notas
  const [gradesOpen, setGradesOpen] = useState(false);
  const [gradesStudentId, setGradesStudentId] = useState(null);

  // Modal de inasistencias
  const [absencesOpen, setAbsencesOpen] = useState(false);
  const [absencesStudentId, setAbsencesStudentId] = useState(null);

  useEffect(() => { saveState(state); }, [state]);

  const selectedCourse = selectedCourseId ? courses[selectedCourseId] : null;

  function setSelectedDate(dateStr){ setState(s => Object.assign({}, s, { selectedDate: dateStr || todayStr() })); }
  function selectCourse(id){ setState(s => Object.assign({}, s, { selectedCourseId:id })); }
  function createCourse(){
    const name = prompt('Nombre del curso (ej. 3°B - Matemática)');
    if (!name || !name.trim()) return;
    const id = uid('curso');
    setState(s => {
      const next = Object.assign({}, s);
      next.selectedCourseId = id;
      next.courses = Object.assign({}, s.courses);
      next.courses[id] = { id, name:name.trim(), students:{} };
      return next;
    });
  }
  function renameCourse(id, newName){
    setState(s=>{
      const next = Object.assign({}, s);
      next.courses = Object.assign({}, s.courses);
      const c = Object.assign({}, next.courses[id]); c.name = newName; next.courses[id] = c;
      return next;
    });
  }
  function deleteCourse(id){
    if (!confirm('¿Eliminar curso y toda su información?')) return;
    setState(s=>{
      const next = Object.assign({}, s);
      next.courses = Object.assign({}, s.courses);
      delete next.courses[id];
      if (s.selectedCourseId === id) next.selectedCourseId = null;
      return next;
    });
  }
  function addStudent(name, condition){
    const id = uid('alumno');
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      students[id] = { id, name, condition: (condition || 'cursa'), stats:{present:0, absent:0, later:0}, history:[], grades:[] };
      course.students = students;
      next.courses = Object.assign({}, next.courses);
      next.courses[selectedCourseId] = course;
      return next;
    });
  }
  function editStudent(id, payload){
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      const st = Object.assign({}, students[id]);
      if (typeof payload === 'string') { st.name = payload; }
      else if (payload && typeof payload === 'object') {
        if (payload.name) st.name = payload.name;
        if (payload.condition) st.condition = payload.condition;
      }
      students[id] = st; course.students = students;
      next.courses = Object.assign({}, next.courses); next.courses[selectedCourseId] = course;
      return next;
    });
  }
  function deleteStudent(id){
    if(!confirm('¿Seguro que querés eliminar a este estudiante y toda su información?')) return;
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      delete students[id]; course.students = students;
      next.courses = Object.assign({}, next.courses); next.courses[selectedCourseId] = course;
      return next;
    });
  }
  function markAttendance(studentId, action, dateStr){
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      const st = Object.assign({}, students[studentId]);
      let stats = safeStats(st.stats); stats = { present:stats.present||0, absent:stats.absent||0, later:stats.later||0 };
      if (action==='present') stats.present += 1;
      if (action==='absent')  stats.absent  += 1;
      if (action==='later')   stats.later   += 1;
      const history = (st.history || []).slice();
      history.push({ id: uid('hist'), date: dateStr || todayStr(), status: action });
      st.stats = stats; st.history = history; students[studentId] = st; course.students = students;
      next.courses = Object.assign({}, next.courses); next.courses[selectedCourseId] = course;
      return next;
    });
  }
  function undoAttendance(studentId, action, dateStr){
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      const st = Object.assign({}, students[studentId]);
      let stats = safeStats(st.stats); stats = { present:stats.present||0, absent:stats.absent||0, later:stats.later||0 };
      const hist = (st.history || []).slice();
      for (let i = hist.length - 1; i >= 0; i--) {
        const h = hist[i];
        if (h.status === action && (dateStr ? h.date === dateStr : true)) {
          hist.splice(i, 1);
          if (action==='present' && stats.present>0) stats.present -= 1;
          if (action==='absent'  && stats.absent>0)  stats.absent  -= 1;
          if (action==='later'   && stats.later>0)   stats.later   -= 1;
          break;
        }
      }
      st.stats = stats; st.history = hist; students[studentId] = st; course.students = students;
      next.courses = Object.assign({}, next.courses); next.courses[selectedCourseId] = course;
      return next;
    });
  }

  function openGrades(student){ setGradesStudentId(student.id); setGradesOpen(true); }
  function openAbsences(student){ setAbsencesStudentId(student.id); setAbsencesOpen(true); }

  function addGrade(studentId, grade){
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      const st = Object.assign({}, students[studentId]);
      const grades = (st.grades || []).slice(); grades.push(grade);
      st.grades = grades; students[studentId] = st; course.students = students;
      next.courses = Object.assign({}, next.courses); next.courses[selectedCourseId] = course;
      return next;
    });
  }
  function editGrade(studentId, grade){
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      const st = Object.assign({}, students[studentId]);
      const grades = (st.grades || []).slice();
      const idx = grades.findIndex(g => g.id === grade.id);
      if(idx !== -1) grades[idx] = grade;
      st.grades = grades; students[studentId] = st; course.students = students;
      next.courses = Object.assign({}, next.courses); next.courses[selectedCourseId] = course;
      return next;
    });
  }
  function deleteGrade(studentId, gradeId){
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      const st = Object.assign({}, students[studentId]);
      const grades = (st.grades || []).filter(g => g.id !== gradeId);
      st.grades = grades; students[studentId] = st; course.students = students;
      next.courses = Object.assign({}, next.courses); next.courses[selectedCourseId] = course;
      return next;
    });
  }

  // Cambiar/Eliminar inasistencia con motivo (tarde/justificada/erronea)
  function applyAbsenceChange(studentId, histId, reason){
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      const st = Object.assign({}, students[studentId]);
      const stats = safeStats(st.stats);
      const hist = (st.history || []).slice();
      const idx = hist.findIndex(h => h.id === histId);
      if (idx === -1) return s; // no changes

      const entry = Object.assign({}, hist[idx]);

      if (reason === 'erronea') {
        // Si era ausencia, descuenta; si era tarde, descuenta tarde
        if (entry.status === 'absent' && stats.absent > 0) stats.absent -= 1;
        if (entry.status === 'tarde'  && stats.later  > 0) stats.later  -= 1;
        hist.splice(idx, 1);
      } else if (reason === 'tarde') {
        // Convertir a TARDE: no cuenta como ausente, sí como "later"
        if (entry.status === 'absent') {
          if (stats.absent > 0) stats.absent -= 1;
          stats.later = (stats.later || 0) + 1;
        }
        entry.status = 'tarde';
        delete entry.reason;
        hist[idx] = entry;
      } else if (reason === 'justificada') {
        // Debe seguir contando como ausencia y seguir en la lista
        // Mantener status 'absent' y marcar reason='justificada'. No se tocan contadores.
        entry.status = 'absent';
        entry.reason = 'justificada';
        hist[idx] = entry;
      }

      st.history = hist;
      st.stats = { present: stats.present||0, absent: stats.absent||0, later: stats.later||0 };
      students[studentId] = st; course.students = students;
      next.courses = Object.assign({}, next.courses); next.courses[selectedCourseId] = course;
      return next;
    });
  }

  const studentsArr = useMemo(() => {
    if (!selectedCourse) return [];
    return Object.values(selectedCourse.students).sort((a,b)=>a.name.localeCompare(b.name));
  }, [selectedCourse]);

  const gradesStudent = selectedCourse && gradesStudentId ? selectedCourse.students[gradesStudentId] || null : null;
  const absencesStudent = selectedCourse && absencesStudentId ? selectedCourse.students[absencesStudentId] || null : null;

  function exportStateJSON(){
    try{
      const data = JSON.stringify(state, null, 2);
      const blob = new Blob([data], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'agenda_backup.json'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      alert('Exportación lista: se descargó agenda_backup.json');
    } catch(err){ alert('No se pudo exportar: ' + (err && err.message ? err.message : err)); }
  }
  function importStateFromText(text){
    try{
      const parsed = JSON.parse(text);
      const next = { courses: parsed && typeof parsed.courses==='object' ? parsed.courses : {}, selectedCourseId: parsed && parsed.selectedCourseId ? parsed.selectedCourseId : null, selectedDate: todayStr() };
      setState(next); alert('Importación exitosa.');
    } catch(err){ alert('Archivo inválido.'); }
  }
  function exportXLSX(){
    if (!selectedCourse) { alert('Primero seleccioná un curso.'); return; }
    const course = selectedCourse;
    const rowsHist = [['Estudiante','Fecha','Estado']];
    Object.values(course.students).forEach(st => { (st.history || []).forEach(h => rowsHist.push([st.name, h.date || '', h.status || ''])); });
    const rowsGrades = [['Estudiante','Fecha','Tipo','Nota']];
    Object.values(course.students).forEach(st => { (st.grades || []).forEach(g => rowsGrades.push([st.name, g.date || '', g.tipo || '', g.value])); });
    const rowsAvg = [['Estudiante','Promedio']];
    Object.values(course.students).forEach(st => rowsAvg.push([st.name, avg(st.grades||[])]));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsHist), 'Historial');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsGrades), 'Calificaciones');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rowsAvg), 'Promedios');
    XLSX.writeFile(wb, `asistencia_${(course.name||'curso').replace(/\s+/g,'_')}.xlsx`);
  }

  return e('div', null,
    e(Header, { selectedDate, onChangeDate:setSelectedDate }),
    e('main', { className:'max-w-5xl mx-auto' },
      Object.keys(courses).length === 0
        ? e(EmptyState, { onCreateCourse:createCourse })
        : e(CoursesBar, { courses, selectedCourseId, onSelect:selectCourse, onCreate:createCourse, onRename:renameCourse, onDelete:deleteCourse }),
      selectedCourse
        ? e('div', null,
            // Primero tarjeta de lista
            e(RollCallCard, { students:studentsArr, selectedDate, onMark:markAttendance, onUndo:undoAttendance }),
            // Luego tabla (abajo)
            e(StudentsTable, {
              students:selectedCourse.students||{},
              onAdd:addStudent,
              onEdit:editStudent,
              onDelete:deleteStudent,
              onShowAbsences:(s)=>openAbsences(s),
              onOpenGrades:(s)=>openGrades(s)
            })
          )
        : null
    ),
    e(BottomActions, { onExportJSON:exportStateJSON, onImportJSON:importStateFromText, onExportXLSX:exportXLSX }),
    e(GradesModal, {
      open:gradesOpen,
      student:gradesStudent,
      onClose:()=>setGradesOpen(false),
      onAdd:(g)=>{ if(gradesStudent) addGrade(gradesStudent.id, g); },
      onEdit:(g)=>{ if(gradesStudent) editGrade(gradesStudent.id, g); },
      onDelete:(id)=>{ if(gradesStudent) deleteGrade(gradesStudent.id, id); }
    }),
    e(AbsencesModal, {
      open:absencesOpen,
      student:absencesStudent,
      onClose:()=>setAbsencesOpen(false),
      onApplyChange:(histId, reason)=>{
        if(absencesStudent){
          applyAbsenceChange(absencesStudent.id, histId, reason);
        }
      }
    })
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(App));
