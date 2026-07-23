function activeRosterStats(classItem=getSelectedClass()){const all=classStudents(classItem);const present=all.filter(s=>s.present);return{all:all.length,present:present.length,absent:all.length-present.length}}
function totalStudentCount(){return getClasses().reduce((sum,item)=>sum+classStudents(item).length,0)}
function drawsToday(){const day=new Date().toISOString().slice(0,10);return getClasses({includeArchived:true}).reduce((sum,item)=>sum+item.drawHistory.filter(entry=>String(entry.createdAt).startsWith(day)).length,0)}
function ensureSelectedClass(){if(getSelectedClass())return getSelectedClass();const first=getClasses()[0]||null;if(first){App.data.selectedClassId=first.id;saveData({render:false,event:'class_auto_select'})}return first}
