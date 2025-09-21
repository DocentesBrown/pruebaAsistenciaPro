// ===== Helpers =====
const { useEffect, useMemo, useState, useRef } = React;
const e = React.createElement;

/* ... resto del código igual que en la versión anterior ... */

/* Cambiado el orden en App(): primero RollCallCard, después StudentsTable */
function App() {
  const [state, setState] = useState(loadState());
  const courses = state.courses;
  const selectedCourseId = state.selectedCourseId;
  const selectedDate = state.selectedDate || todayStr();

  const [gradesOpen, setGradesOpen] = useState(false);
  const [gradesStudent, setGradesStudent] = useState(null);

  useEffect(() => { saveState(state); }, [state]);

  const selectedCourse = selectedCourseId ? courses[selectedCourseId] : null;
  const studentsArr = useMemo(() => {
    if (!selectedCourse) return [];
    return Object.values(selectedCourse.students).sort((a,b)=>a.name.localeCompare(b.name));
  }, [selectedCourse]);

  return e('div', null,
    e(Header, { selectedDate, onChangeDate:setSelectedDate }),
    e('main', { className:'max-w-5xl mx-auto' },
      Object.keys(courses).length === 0
        ? e(EmptyState, { onCreateCourse:createCourse })
        : e(CoursesBar, { courses, selectedCourseId, onSelect:selectCourse, onCreate:createCourse, onRename:renameCourse, onDelete:deleteCourse }),
      selectedCourse
        ? e('div', null,
            selectedCourse.sheetId
              ? e('p', { className:'px-4 md:px-6 mt-2 text-sm' },
                  e('a', { href:`https://docs.google.com/spreadsheets/d/${selectedCourse.sheetId}/edit`, target:'_blank', rel:'noopener', className:'underline', style:{color:'#6c467e'} }, 'Abrir Google Sheet')
                )
              : null,
            // Ahora primero la tarjeta de lista
            e(RollCallCard, { students:studentsArr, selectedDate, onMark:markAttendance, onUndo:undoAttendance }),
            // Y después la tabla
            e(StudentsTable, {
              students:selectedCourse.students||{},
              onAdd:addStudent,
              onEdit:editStudent,
              onDelete:deleteStudent,
              onShowAbsences:(s)=>alert((s.history||[]).filter(h=>h.status==='absent').map(h=>h.date).join('\n') || 'Sin ausencias'),
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
    })
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(e(App));
