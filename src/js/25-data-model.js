function getClasses({includeArchived=false}={}){return App.data.classes.filter(item=>includeArchived||!item.archived)}
function getSelectedClass(){return App.data.classes.find(item=>item.id===App.data.selectedClassId)||null}
function setSelectedClass(classId){if(!App.data.classes.some(item=>item.id===classId))return false;App.data.selectedClassId=classId;saveData({event:'class_select'});recordEvent('class_select');return true}
function classStudents(classItem=getSelectedClass(),{presentOnly=false,includeArchived=false}={}){if(!classItem)return[];return classItem.students.filter(student=>(includeArchived||!student.archived)&&(!presentOnly||student.present))}
function rosterSignature(classItem=getSelectedClass()){return classStudents(classItem,{presentOnly:true}).map(item=>item.id).sort().join('|')}
function resetClassDraw(classItem=getSelectedClass()){if(!classItem)return;classItem.drawState={remainingIds:[],cycle:Number(classItem.drawState?.cycle||0),lastDraw:null}}
function touchClass(classItem,{rosterChanged=false,attendanceChanged=false}={}){
  classItem.updatedAt=nowIso();
  if(rosterChanged){
    resetClassDraw(classItem);
    classItem.currentGroups=[];
    classItem.seatingPlan.seats=classItem.seatingPlan.seats.map(seat=>({...seat,studentId:null,locked:false}));
    return;
  }
  if(attendanceChanged)syncDrawDeck(classItem);
}
function makeStudent(firstName,lastName){firstName=titleCase(firstName);lastName=titleCase(lastName);return sanitizeStudent({id:uid('student'),firstName,lastName,present:true,archived:false,groupLevel:'B',frontPreference:false,createdAt:nowIso(),updatedAt:nowIso()})}
function createClass({name,schoolYear='',students=[]}){const classItem=sanitizeClass({id:uid('class'),name:String(name||'Nová třída').trim(),schoolYear:String(schoolYear||'').trim(),students,createdAt:nowIso(),updatedAt:nowIso()});App.data.classes.unshift(classItem);App.data.selectedClassId=classItem.id;saveData({event:'class_create'});recordEvent('class_create',{studentCount:classItem.students.length});return classItem}
function updateClassMeta(classId,{name,schoolYear}){const item=App.data.classes.find(entry=>entry.id===classId);if(!item)return false;if(name?.trim())item.name=name.trim();if(schoolYear!==undefined)item.schoolYear=String(schoolYear).trim();touchClass(item);saveData({event:'class_update'});return true}
function duplicateClass(classId){const source=App.data.classes.find(item=>item.id===classId);if(!source)return null;const copy=createClass({name:`${source.name} – kopie`,schoolYear:source.schoolYear,students:source.students.filter(s=>!s.archived).map(s=>sanitizeStudent({...s,id:uid('student'),createdAt:nowIso(),updatedAt:nowIso()}))});copy.roleCatalog=[...source.roleCatalog];copy.topicCatalog=[...source.topicCatalog];saveData({event:'class_duplicate'});return copy}
function archiveClass(classId,archived=true){const item=App.data.classes.find(entry=>entry.id===classId);if(!item)return false;item.archived=archived;touchClass(item);if(archived&&App.data.selectedClassId===classId)App.data.selectedClassId=getClasses().find(entry=>entry.id!==classId)?.id||null;saveData({event:archived?'class_archive':'class_restore'});return true}
function deleteClass(classId){const index=App.data.classes.findIndex(item=>item.id===classId);if(index<0)return false;App.data.classes.splice(index,1);if(App.data.selectedClassId===classId)App.data.selectedClassId=getClasses().find(Boolean)?.id||null;saveData({event:'class_delete'});recordEvent('class_delete');return true}
function duplicateNameError(message){const error=new Error(message);error.code='DUPLICATE_STUDENT_NAME';return error}
function addStudent(classId,firstName,lastName,{allowDuplicate=false}={}){const item=App.data.classes.find(entry=>entry.id===classId);if(!item)return null;const student=makeStudent(firstName,lastName);if(!student)return null;if(!allowDuplicate&&item.students.some(entry=>!entry.archived&&entry.key===student.key))throw duplicateNameError('Student se stejným jménem už ve třídě je. Přidat jej přesto?');item.students.push(student);touchClass(item,{rosterChanged:true});saveData({event:'student_add'});return student}
function updateStudent(classId,studentId,patch={}, {allowDuplicate=false}={}){
  const classItem=App.data.classes.find(entry=>entry.id===classId);
  const student=classItem?.students.find(entry=>entry.id===studentId);
  if(!student)return false;
  const rosterChanged=['firstName','lastName','archived'].some(key=>key in patch);
  const attendanceChanged='present'in patch;
  const nextFirst='firstName'in patch?titleCase(patch.firstName):student.firstName;
  const nextLast='lastName'in patch?titleCase(patch.lastName):student.lastName;
  const nextKey=normalizeText(`${nextFirst} ${nextLast}`);
  if(!allowDuplicate&&rosterChanged&&!('archived'in patch&&patch.archived)&&classItem.students.some(entry=>entry.id!==studentId&&!entry.archived&&entry.key===nextKey))throw duplicateNameError('Jiný student se stejným jménem už ve třídě je. Uložit přesto?');
  if('firstName'in patch)student.firstName=nextFirst;
  if('lastName'in patch)student.lastName=nextLast;
  if('present'in patch)student.present=!!patch.present;
  if('archived'in patch)student.archived=!!patch.archived;
  if('groupLevel'in patch&&['A','B','C'].includes(patch.groupLevel))student.groupLevel=patch.groupLevel;
  if('frontPreference'in patch)student.frontPreference=!!patch.frontPreference;
  student.displayName=`${student.firstName} ${student.lastName}`.trim();
  student.key=normalizeText(student.displayName);
  student.updatedAt=nowIso();
  touchClass(classItem,{rosterChanged,attendanceChanged});
  saveData({event:'student_update'});
  return true;
}
function removeStudent(classId,studentId){const classItem=App.data.classes.find(entry=>entry.id===classId);if(classItem){classItem.groupRules.together=classItem.groupRules.together.filter(pair=>!pair.includes(studentId));classItem.groupRules.apart=classItem.groupRules.apart.filter(pair=>!pair.includes(studentId));delete classItem.groupRules.pins[studentId]}return updateStudent(classId,studentId,{archived:true,present:false})}
function setAllPresence(classId,present){
  const classItem=App.data.classes.find(entry=>entry.id===classId);
  if(!classItem)return;
  const changedAt=nowIso();
  classItem.students.filter(s=>!s.archived).forEach(student=>{student.present=present;student.updatedAt=changedAt});
  touchClass(classItem,{attendanceChanged:true});
  saveData({event:'attendance_all'});
  recordEvent('attendance_change',{present});
}
