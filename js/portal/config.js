/* CONFIG — programs, filters, state (S), navigation ug ang user nga naka-sign in */

/* Global ang mga function/variable sa portal aron magamit sa tanang file */
var icon = CARE.icon;
function ST() { return CARE.db.students(); }   // tanang student records
function RP() { return CARE.db.reports(); }    // tanang rescue reports

var PROGRAMS = [
  {code:'BAPOS', name:'Bachelor of Arts in Political Science'},
  {code:'BSIT',  name:'Bachelor of Science in Information Technology'},
  {code:'BSBA',  name:'Bachelor of Science in Business Administration'},
  {code:'BSHM',  name:'Bachelor of Science in Hospitality Management'},
  {code:'BEED',  name:'Bachelor of Elementary Education'},
  {code:'BSED-ENG',  name:'Bachelor of Secondary Education – English'},
  {code:'BSED-FIL',  name:'Bachelor of Secondary Education – Filipino'},
  {code:'BSED-MATH', name:'Bachelor of Secondary Education – Mathematics'}
];
function progName(code){
  var p=PROGRAMS.filter(function(x){return x.code===code;})[0];
  return p?p.name:code;
}

var RSORTS = ['Pending first','Resolved first','Newest first','Oldest first'];
var SRANK = {'Pending Clinic Review':0, 'Reviewed':1, 'Resolved':2};

var S = {role:null, me:null, view:'login', loginRole:'qrt', loginUser:'', hist:[], dark:localStorage.getItem('care.theme')==='dark', pwMsg:null, pwModal:false, reset:null, loginErr:null, rsort:'Pending first', sid:null, rid:null,
         q:'', quick:false, prog:'All Programs', block:'All Blocks', year:'All Years', sort:'Last Name A–Z', flash:null, editing:false};

var BLOCKS = ['All Blocks','1A','1B','2A','2B','3A','3B','3C','4A','4B'];
var PROGOPTS = ['All Programs'].concat(PROGRAMS.map(function(p){return p.code;}));
var YEARS  = ['All Years','1st Year','2nd Year','3rd Year','4th Year'];
var SORTS  = ['Last Name A–Z','Last Name Z–A','Year Level','Program'];

var NAV = {
  qrt:[['qrt-dashboard','Dashboard','home'],['qrt-search','Student search','search'],
       ['qrt-history','Rescue reports','pulse']],
  clinic:[['clinic-dashboard','Dashboard','home'],['clinic-records','Student records','users'],
          ['clinic-reports','SQRT rescue reports','pulse']]
};
var MNAV = {
  qrt:[['qrt-dashboard','Home','home'],['qrt-search','Search','search'],['qrt-history','Reports','pulse']],
  clinic:[['clinic-dashboard','Home','home'],['clinic-records','Records','users'],['clinic-reports','Reports','pulse']]
};
function rootOf(v){
  if(v.indexOf('qrt-record')===0||v.indexOf('qrt-search')===0) return 'qrt-search';
  if(v.indexOf('qrt-report')===0||v==='qrt-history') return 'qrt-history';
  if(v.indexOf('clinic-record')===0) return 'clinic-records';
  if(v==='clinic-review'||v==='clinic-reports') return 'clinic-reports';
  if(v==='clinic-add') return 'clinic-records';
  return v;
}

// Ang user nga naka-sign in (para sa sidebar ug profile)
function me() {
  var a = S.me;
  return { name: a.name, role: a.role === 'SQRT' ? 'SQRT responder' : 'Clinic staff',
           init: (a.first[0] + a.last[0]).toUpperCase(), idno: a.idno, user: a.user, dept: a.dept };
}
// Isulat sa access log ang buhat (makita sa Admin > Access logs)
function audit(act, rec) { CARE.db.audit(act, rec); }

