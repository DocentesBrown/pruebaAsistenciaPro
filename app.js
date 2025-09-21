
// ===== Helpers =====
const { useEffect, useMemo, useState, useRef } = React;
const e = React.createElement;

const LS_KEY = 'agenda_estudiantes_v2'; // bump version to avoid incompatible old state
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
  // Por defecto SIEMPRE mostrar la fecha de HOY (se puede modificar luego)
  try {
    const raw = localStorage.getItem(LS_KEY);
    const base = { courses:{}, selectedCourseId:null, selectedDate: todayStr() };
    if (!raw) return base;
    const parsed = JSON.parse(raw);
    return {
      courses: parsed.courses || {},
      selectedCourseId: parsed.selectedCourseId || null,
      // ignoramos la fecha guardada y arrancamos siempre en "hoy"
      selectedDate: todayStr()
    };
  } catch {
    return { courses:{}, selectedCourseId:null, selectedDate: todayStr() };
  }
}
function saveState(state){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }

// ===== UI Components =====

function Header({ selectedDate, onChangeDate }) {
  return e('header',
    { className: 'w-full p-4 md:p-6 text-white flex items-center justify-between sticky top-0 z-10 shadow',
      style:{ background:'#24496e' } },
    e('div', { className:'flex flex-col gap-1' },
      e('div', { className:'flex items-center gap-3' },
        e('span', { className:'text-2xl md:text-3xl font-bold tracking-tight' }, 'Asistencia de Estudiantes')
      ),
      e('a', {
          href:'https://www.instagram.com/docentesbrown',
          target:'_blank',
          rel:'noopener',
          className:'text-xs md:text-sm underline',
          style:{ opacity:.9 }
        }, 'creado por @docentesbrown')
    ),
    e('div', { className:'flex items-center gap-2' },
      e('label', { className:'text-sm opacity-90 hidden md:block' }, 'Fecha:'),
      e('input', {
        type:'date',
        value:selectedDate,
        onChange:(ev)=>onChangeDate(ev.target.value),
        className:'rounded-md px-2 py-1 text-sm',
        style:{ color:'#24496e' }
      })
    )
  );
}

function EmptyState({ onCreateCourse }) {
  return e('div', { className:'p-6 md:p-10 text-center' },
    e('h2', { className:'text-xl md:text-2xl font-semibold mb-2', style:{ color:'#24496e' } }, 'No hay cursos aún'),
    e('p', { className:'text-slate-700 mb-4' }, 'Creá tu primer curso para comenzar.'),
    e('button', { onClick:onCreateCourse,
      className:'px-4 py-2 rounded-xl text-white shadow',
      style:{ background:'#6c467e' } }, '+ Nuevo curso')
  );
}

function CoursesBar({ courses, selectedCourseId, onSelect, onCreate, onRename, onDelete }) {
  const [renamingId, setRenamingId] = useState(null);
  const [newName, setNewName]   = useState('');

  return e('div', { className:'w-full overflow-x-auto border-b border-slate-300 bg-white' },
    e('div', { className:'flex items-center gap-2 p-3 min-w-max' },
      ...Object.values(courses).map((c) =>
        e('div', {
          key:c.id,
          className:'flex items-center gap-2 px-3 py-2 rounded-2xl border',
          style: selectedCourseId===c.id
            ? { borderColor:'#24496e', background:'#f0f4f8' }
            : { borderColor:'#d7dbe0' }
        },
          renamingId===c.id
            ? e('input', {
                autoFocus:true, value:newName,
                onChange:(ev)=>setNewName(ev.target.value),
                onBlur:()=>{ onRename(c.id, newName || c.name); setRenamingId(null); },
                onKeyDown:(ev)=>{ if(ev.key==='Enter'){ onRename(c.id, newName||c.name); setRenamingId(null); } if(ev.key==='Escape'){ setRenamingId(null); } },
                className:'px-2 py-1 text-sm border rounded',
                style:{ borderColor:'#d7dbe0' }
              })
            : e('button', {
                className:'text-sm font-medium',
                style:{ color: selectedCourseId===c.id ? '#24496e' : '#334155' },
                onClick:()=>onSelect(c.id)
              }, c.name),
          e('div', { className:'flex items-center gap-1' },
            e('button', { title:'Renombrar',
              onClick:()=>{ setRenamingId(c.id); setNewName(c.name); },
              className:'text-xs px-2 py-1 rounded',
              style:{ background:'#f3efdc', color:'#24496e' } }, '✎'),
            e('button', { title:'Eliminar curso', onClick:()=>onDelete(c.id),
              className:'text-xs px-2 py-1 rounded',
              style:{ background:'#fde2e0', color:'#da6863' } }, '🗑')
          )
        )
      ),
      e('button', { onClick:onCreate,
        className:'px-3 py-2 rounded-2xl text-sm',
        style:{ background:'#f3efdc', color:'#24496e' } }, '+ Nuevo curso')
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
        e('input', {
          placeholder:'Nombre y apellido', value:name, onChange:(ev)=>setName(ev.target.value),
          className:'w-full max-w-md px-3 py-2 border rounded-xl',
          style:{ borderColor:'#d7dbe0' }
        })
      ),
      e('div', { className:'flex items-center gap-2' },
        e('select', { value:cond, onChange:(ev)=>setCond(ev.target.value), className:'px-3 py-2 border rounded-xl', style:{ borderColor:'#d7dbe0' } },
          e('option', {value:'cursa'}, 'Cursa'),
          e('option', {value:'recursa'}, 'Recursa')
        )
      ),
      e('button', {
        onClick:()=>{ if(!name.trim()) return; onAdd(name.trim(), cond); setName(''); },
        className:'px-4 py-2 rounded-xl text-white',
        style:{ background:'#6c467e' }
      }, '+ Agregar')
    ),
    e('div', { className:'overflow-x-auto' },
      e('table', { className:'w-full text-left border rounded-xl overflow-hidden', style:{ borderColor:'#cbd5e1' } },
        // CABECERA azul + texto blanco
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
        // CUERPO con zebra y acciones
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
                      (s.condition ? e('span', { className:'text-[10px] px-2 py-0.5 rounded-full', style:{ background: s.condition==='recursa' ? '#fde2e0' : '#e8f7ef', color: s.condition==='recursa' ? '#da6863' : '#166534' } }, s.condition==='recursa' ? 'Recursa' : 'Cursa') : null),
                      e('button', {
                        onClick:()=>{ const nuevo = prompt('Editar nombre', s.name); if(nuevo && nuevo.trim()) onEdit(s.id, nuevo.trim()); },
                        className:'text-xs px-2 py-1 rounded',
                        style:{ background:'#f3efdc', color:'#24496e' }
                      }, 'Editar')
                    )
                  ),
                  e('td', { className:'p-3 font-semibold', style:{ color:'#24496e' } }, pct(st) + '%'),
                  e('td', { className:'p-3' }, st.present || 0),
                  e('td', { className:'p-3' },
                    e('div', { className:'flex items-center gap-2' },
                      e('span', null, st.absent || 0),
                      e('button', {
                        onClick:()=>onShowAbsences(s),
                        className:'text-xs px-2 py-1 rounded',
                        style:{ background:'#f3efdc', color:'#24496e' }
                      }, 'Fechas')
                    )
                  ),
                  e('td', { className:'p-3 font-semibold', style:{ color:'#24496e' } }, promedio.toFixed(2)),
                  e('td', { className:'p-3 text-right' },
                    e('div', {className:'flex gap-2 justify-end'},
                      e('button', {
                        onClick:()=>onOpenGrades(s),
                        className:'text-xs px-3 py-1 rounded',
                        style:{ background:'#f0eaf5', color:'#6c467e' } }, 'Notas'),
                      e('button', { onClick:()=>{ if(confirm('¿Eliminar estudiante y sus datos?')) onDelete(s.id); },
                        className:'text-xs px-3 py-1 rounded',
                        style:{ background:'#fde2e0', color:'#da6863' } }, 'Eliminar')
                    )
                  )
                );
              })
            : [e('tr', { key:'empty' },
                e('td', { colSpan:6, className:'p-4 text-center text-slate-500' }, 'Sin estudiantes. Agregue usando el campo superior.')
              )]
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

  useEffect(() => {
    setOrder(students.map(s => s.id));
    setIndex(0);
    setOps([]);
  }, [students.map(s => s.id).join('|')]);

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
              e('div', { className:'text-sm md:text-base text-slate-700' },
                'Asistencia acumulada: ', e('span', { className:'font-semibold', style:{ color:'#24496e' } }, pct(current.stats) + '%'),
                ' · Fecha sesión: ', e('span', { className:'font-semibold', style:{ color:'#24496e' } }, selectedDate)
              )
            ),
            e('div', { className:'grid grid-cols-2 gap-3 md:gap-4' },
              // Presente (verde suave)
              e('button', {
                onClick:()=>handleAction('present'),
                className:'py-3 md:py-4 rounded-2xl font-semibold border',
                style:{ background:'#e8f7ef', borderColor:'#cdebdc', color:'#166534' } // verde suave
              }, 'Presente ✅'),
              // Ausente (rojo suave)
              e('button', {
                onClick:()=>handleAction('absent'),
                className:'py-3 md:py-4 rounded-2xl font-semibold border',
                style:{ background:'#fdecea', borderColor:'#f7d7d3', color:'#991b1b' } // rojo suave
              }, 'Ausente ❌'),
              // Revisar más tarde (violeta suave)
              e('button', {
                onClick:()=>handleAction('later'),
                className:'py-3 md:py-4 rounded-2xl font-semibold border col-span-2',
                style:{ background:'#f0eaf5', borderColor:'#e2d7ec', color:'#6c467e' }
              }, 'Revisar más tarde ⏳'),
              e('button', {
                onClick:goBack,
                className:'py-2 md:py-2.5 rounded-xl font-medium col-span-2',
                style:{ background:'#f3efdc', color:'#24496e' }
              }, '← Volver al anterior (deshacer)')
            )
          )
        : e('div', { className:'rounded-3xl border shadow p-6 md:p-8 bg-white text-center', style:{ borderColor:'#d7dbe0' } },
            e('div', { className:'text-xl font-semibold mb-2', style:{ color:'#24496e' } }, '¡Lista completada!'),
            e('div', { className:'text-slate-700' }, 'Ya asignaste estado a todos los estudiantes. Podés volver a empezar o revisar el resumen abajo.')
          )
    )
  );
}

// Barra inferior con Importar/Exportar (reordenada: XLSX → Export JSON → Import JSON)
function BottomActions({ onExportJSON, onImportJSON, onExportXLSX }) {
  const fileRef = useRef(null);
  function triggerImport(){ if(fileRef.current) fileRef.current.click(); }
  function handleFile(ev){
    const file = ev.target.files && ev.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => { try { onImportJSON(reader.result); } finally { ev.target.value=''; } };
    reader.readAsText(file);
  }

  return e('div', { className:'p-4 md:p-6 sticky bottom-0 bg-white border-t shadow-sm',
    style:{ borderColor:'#d7dbe0' } },
    e('div', { className:'max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3' },
      // 1) XLSX
      e('button', { onClick:onExportXLSX,
        className:'px-4 py-2 rounded-xl text-white font-semibold',
        style:{ background:'#24496e' } }, 'Exportar .xlsx'),
      // 2) Exportar JSON
      e('button', { onClick:onExportJSON,
        className:'px-4 py-2 rounded-xl font-semibold',
        style:{ background:'#f3efdc', color:'#24496e' } }, 'Exportar JSON'),
      // 3) Importar JSON
      e('button', { onClick:()=> (fileRef.current && fileRef.current.click()),
        className:'px-4 py-2 rounded-xl font-semibold',
        style:{ background:'#f3efdc', color:'#24496e' } }, 'Importar JSON'),
      e('input', { ref:fileRef, type:'file', accept:'.json,application/json', className:'hidden', onChange:handleFile })
    )
  );
}

// Modal simple
function Modal({ open, title, onClose, children }) {
  if (!open) return null;
  return e('div', { className:'fixed inset-0 z-50 flex items-end sm:items-center justify-center' },
    e('div', { className:'absolute inset-0', onClick:onClose, style:{ background:'rgba(0,0,0,.4)' } }),
    e('div', { className:'relative w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-lg p-4 sm:p-6 m-0 sm:m-4',
      style:{ background:'#ffffff', border:'1px solid #d7dbe0' } },
      e('div', { className:'flex items-center justify-between mb-3' },
        e('h3', { className:'text-lg font-semibold', style:{ color:'#24496e' } }, title),
        e('button', { onClick:onClose, className:'px-2 py-1 rounded', style:{ background:'#f3efdc', color:'#24496e' } }, '✕')
      ),
      e('div', null, children)
    )
  );
}

// Modal de calificaciones por estudiante
function GradesModal({ open, student, onClose, onAdd, onEdit, onDelete }) {
  const [label, setLabel] = useState('');
  const [tipo, setTipo] = useState('escrito');
  const [date, setDate] = useState(todayStr());
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) {
      setLabel('');
      setTipo('escrito');
      setDate(todayStr());
      setValue('');
    }
  }, [open]);

  if(!open || !student) return null;
  const grades = (student.grades||[]).slice().sort((a,b)=>(a.date||'').localeCompare(b.date||''));
  const promedio = avg(grades);

  return e(Modal, { open, title:`Calificaciones – ${student.name}`, onClose },
    e('div', { className:'space-y-4' },
      e('div', { className:'grid grid-cols-1 sm:grid-cols-4 gap-2' },
        e('input', { className:'px-3 py-2 border rounded-xl sm:col-span-2', style:{borderColor:'#d7dbe0'},
          placeholder:'Evaluación (ej. Parcial 1)', value:label, onChange:(ev)=>setLabel(ev.target.value) }),
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
            if(!label.trim() || Number.isNaN(v)) { alert('Completá evaluación y un número válido.'); return; }
            onAdd({ id: uid('nota'), label: label.trim(), tipo, date: date || todayStr(), value: v });
            setLabel(''); setValue('');
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
              e('th', {className:'p-2 text-sm'}, 'Evaluación'),
              e('th', {className:'p-2 text-sm'}, 'Tipo'),
              e('th', {className:'p-2 text-sm'}, 'Nota'),
              e('th', {className:'p-2 text-sm'})
            )
          ),
          e('tbody', null,
            ...(grades.length ? grades.map(g =>
              e('tr', {key:g.id, className:'border-t', style:{borderColor:'#e2e8f0'}},
                e('td', {className:'p-2'}, g.date || ''),
                e('td', {className:'p-2'}, g.label || ''),
                e('td', {className:'p-2'}, (g.tipo ? (g.tipo.charAt(0).toUpperCase()+g.tipo.slice(1)) : '')),
                e('td', {className:'p-2'}, String(g.value)),
                e('td', {className:'p-2 text-right'},
                  e('button', { className:'text-xs px-2 py-1 rounded mr-2', style:{background:'#f3efdc', color:'#24496e'},
                    onClick:()=>{
                      const newLabel = prompt('Editar evaluación', g.label || '') ?? g.label;
                      const newDate = prompt('Editar fecha (YYYY-MM-DD)', g.date || todayStr()) ?? g.date;
                      const newValueRaw = prompt('Editar nota', String(g.value));
                      const nv = Number(newValueRaw);
                      if(Number.isNaN(nv)) return;
                      onEdit({ ...g, label:newLabel, date:newDate, value:nv });
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

function App() {
  const [state, setState] = useState(loadState());
  const courses = state.courses;
  const selectedCourseId = state.selectedCourseId;
  const selectedDate = state.selectedDate || todayStr();

  const [modalOpen, setModalOpen] = useState(false);
  const [modalStudent, setModalStudent] = useState(null);
  const [modalDates, setModalDates] = useState([]);

  const [gradesOpen, setGradesOpen] = useState(false);
  const [gradesStudent, setGradesStudent] = useState(null);

  useEffect(() => { saveState(state); }, [state]);

  const selectedCourse = selectedCourseId ? courses[selectedCourseId] : null;

  function setSelectedDate(dateStr){
    setState(s => Object.assign({}, s, { selectedDate: dateStr || todayStr() }));
  }
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
  function editStudent(id, newName){
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      const st = Object.assign({}, students[id]); st.name = newName; students[id] = st;
      course.students = students;
      next.courses = Object.assign({}, next.courses);
      next.courses[selectedCourseId] = course;
      return next;
    });
  }
  function deleteStudent(id){
    if(!confirm('¿Seguro que querés eliminar a este estudiante y toda su información?')) return;
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      delete students[id];
      course.students = students;
      next.courses = Object.assign({}, next.courses);
      next.courses[selectedCourseId] = course;
      return next;
    });
  }

  // Registra marca con fecha; acumula stats y apendea historial [{date,status}]
  function markAttendance(studentId, action, dateStr){
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      const st = Object.assign({}, students[studentId]);
      let stats = safeStats(st.stats);
      stats = { present:stats.present||0, absent:stats.absent||0, later:stats.later||0 };
      if (action==='present') stats.present += 1;
      if (action==='absent')  stats.absent  += 1;
      if (action==='later')   stats.later   += 1;
      const history = (st.history || []).slice();
      history.push({ date: dateStr || todayStr(), status: action });
      st.stats = stats; st.history = history; students[studentId] = st; course.students = students;
      next.courses = Object.assign({}, next.courses); next.courses[selectedCourseId] = course;
      return next;
    });
  }

  // Deshacer última marca
  function undoAttendance(studentId, action, dateStr){
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      const st = Object.assign({}, students[studentId]);
      let stats = safeStats(st.stats);
      stats = { present:stats.present||0, absent:stats.absent||0, later:stats.later||0 };

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

  // Notas: abrir modal
  function openGrades(student){
    setGradesStudent(student);
    setGradesOpen(true);
  }
  function addGrade(studentId, grade){
    setState(s=>{
      const next = Object.assign({}, s);
      const course = Object.assign({}, next.courses[selectedCourseId]);
      const students = Object.assign({}, course.students);
      const st = Object.assign({}, students[studentId]);
      const grades = (st.grades || []).slice();
      grades.push(grade);
      st.grades = grades;
      students[studentId] = st;
      course.students = students;
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
      st.grades = grades;
      students[studentId] = st;
      course.students = students;
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
      st.grades = grades;
      students[studentId] = st;
      course.students = students;
      next.courses = Object.assign({}, next.courses); next.courses[selectedCourseId] = course;
      return next;
    });
  }

  const studentsArr = useMemo(() => {
    if (!selectedCourse) return [];
    return Object.values(selectedCourse.students).sort((a,b)=>a.name.localeCompare(b.name));
  }, [selectedCourse]);

  // Export / Import JSON
  function exportStateJSON(){
    try{
      const data = JSON.stringify(state, null, 2);
      const blob = new Blob([data], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'agenda_backup.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      alert('Exportación lista: se descargó agenda_backup.json');
    } catch(err){
      alert('No se pudo exportar: ' + (err && err.message ? err.message : err));
    }
  }
  function importStateFromText(text){
    try{
      const parsed = JSON.parse(text);
      const next = {
        courses: parsed && typeof parsed.courses==='object' ? parsed.courses : {},
        selectedCourseId: parsed && parsed.selectedCourseId ? parsed.selectedCourseId : null,
        selectedDate: todayStr()
      };
      setState(next);
      alert('Importación exitosa. ¡Listo para usar!');
    } catch(err){
      alert('Archivo inválido. Debe ser un JSON exportado por esta app.');
    }
  }

  // Exportar a XLSX (historial por estudiante con fechas y estado + calificaciones)
  function exportXLSX(){
    if (!selectedCourse) { alert('Primero seleccioná un curso.'); return; }
    const course = selectedCourse;
    // Hoja "Historial": Estudiante | Fecha | Estado
    const rows = [['Estudiante','Fecha','Estado']];
    Object.values(course.students).forEach(st => {
      (st.history || []).forEach(h => {
        rows.push([st.name, h.date, h.status]);
      });
    });
    // Hoja "Resumen": Estudiante | Presente | Ausente | % Asistencia
    const resumen = [['Estudiante','Presente','Ausente','% Asistencia']];
    Object.values(course.students).forEach(st => {
      const stats = safeStats(st.stats);
      resumen.push([st.name, stats.present||0, stats.absent||0, pct(stats)]);
    });
    // Hoja "Calificaciones": Estudiante | Fecha | Evaluación | Nota
    const califs = [['Estudiante','Fecha','Evaluación','Nota']];
    Object.values(course.students).forEach(st => {
      (st.grades || []).forEach(g => {
        califs.push([st.name, g.date||'', g.label||'', g.value]);
      });
    });
    // Hoja "Promedios": Estudiante | Promedio
    const proms = [['Estudiante','Promedio']];
    Object.values(course.students).forEach(st => {
      proms.push([st.name, avg(st.grades||[])]);
    });

    // Crear libro
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Historial');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), 'Resumen');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(califs), 'Calificaciones');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(proms), 'Promedios');

    const fileName = `asistencia_${course.name.replace(/[^\w\\-]+/g,'_')}.xlsx`;
    XLSX.writeFile(wb, fileName);
  }

  // Modal: mostrar fechas de ausencias de un estudiante
  function showAbsences(student){
    const dates = (student.history || []).filter(h => h.status === 'absent').map(h => h.date).sort();
    setModalStudent(student);
    setModalDates(dates);
    setModalOpen(true);
  }

  return e('div', null,
    e(Header, { selectedDate, onChangeDate:setSelectedDate }),
    Object.keys(courses).length === 0
      ? e(EmptyState, { onCreateCourse:createCourse })
      : e(React.Fragment, null,
          e(CoursesBar, {
            courses, selectedCourseId,
            onSelect:selectCourse, onCreate:createCourse, onRename:renameCourse, onDelete:deleteCourse
          }),
          !selectedCourse
            ? e('div', { className:'p-6 text-slate-700' }, 'Seleccioná un curso para administrar estudiantes, tomar lista y cargar notas.')
            : e(React.Fragment, null,
                e('div', { className:'p-4 md:p-6' },
                  e('h2', { className:'text-xl md:text-2xl font-semibold', style:{ color:'#24496e' } }, selectedCourse.name),
                  e('p',  { className:'text-slate-700' }, 'Estudiantes: ' + studentsArr.length)
                ),
                e(RollCallCard, {
                  students:studentsArr,
                  selectedDate,
                  onMark:markAttendance,
                  onUndo:undoAttendance
                }),
                e(StudentsTable, {
                  students:selectedCourse.students,
                  onAdd:addStudent,
                  onEdit:editStudent,
                  onDelete:deleteStudent,
                  onShowAbsences:showAbsences,
                  onOpenGrades:openGrades
                }),
                e(BottomActions, {
                  onExportJSON:exportStateJSON,
                  onImportJSON:importStateFromText,
                  onExportXLSX:exportXLSX
                })
              )
        ),

    e(Modal, {
      open:modalOpen,
      title: modalStudent ? `Fechas de ausencia – ${modalStudent.name}` : 'Fechas de ausencia',
      onClose:()=>setModalOpen(false)
    },
      modalDates.length
        ? e('ul', { className:'list-disc ml-5 space-y-1' }, ...modalDates.map((d,i)=>e('li',{key:i},d)))
        : e('div', { className:'text-slate-700' }, 'No hay inasistencias registradas.')
    ),

    e(GradesModal, {
      open:gradesOpen,
      student:gradesStudent,
      onClose:()=>setGradesOpen(false),
      onAdd:(grade)=> gradesStudent && addGrade(gradesStudent.id, grade),
      onEdit:(grade)=> gradesStudent && editGrade(gradesStudent.id, grade),
      onDelete:(id)=> gradesStudent && deleteGrade(gradesStudent.id, id)
    })
  );
}

// ===== Render =====
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(App));

// (tests integrados mínimos)
(function runSmoke(){
  function assert(name, cond){ return { name, pass: !!cond }; }
  const t1 = assert('pct 3/5 = 60%', pct({present:3, absent:2}) === 60);
  const t2 = assert('avg [6,8] = 7', avg([{value:6},{value:8}]) === 7);
  console.log('TESTS:', [t1, t2]);
})();
