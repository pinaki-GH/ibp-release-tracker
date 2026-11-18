"use client";

import { useEffect, useMemo, useState } from "react";

type RecordItem = {
  id: string;
  productAppName: string; productAppId: string; businessProductOwner: string; costNetwork: string;
  itProjectId: string; itServiceId: string; itServiceOwner: string; itServiceManager: string; lifecycleStage: string;
  ciaId: string; ciaValidity: string; socId: string; socValidity: string; itTradeComplianceId: string;
  soxAssessmentId: string; soxStatus: string; itDrAssuranceId: string; itDrRiskAssessmentValidity: string;
  adqId: string; adqStatus: string;
};
type Field = keyof Omit<RecordItem, "id">;
const KEY = "productAppRegister:records:v1";
const EMPTY: Omit<RecordItem, "id"> = {
  productAppName:"", productAppId:"", businessProductOwner:"", costNetwork:"", itProjectId:"", itServiceId:"",
  itServiceOwner:"", itServiceManager:"", lifecycleStage:"", ciaId:"", ciaValidity:"", socId:"", socValidity:"",
  itTradeComplianceId:"", soxAssessmentId:"", soxStatus:"", itDrAssuranceId:"", itDrRiskAssessmentValidity:"", adqId:"", adqStatus:""
};
const GROUPS: {title:string; note:string; fields:{key:Field; label:string; date?:boolean}[]}[] = [
  {title:"Product & ownership",note:"Identity, business ownership and cost allocation",fields:[
    {key:"productAppName",label:"Product / App Name"},{key:"productAppId",label:"Product / App ID"},{key:"businessProductOwner",label:"Business Product Owner"},{key:"costNetwork",label:"Cost Network"}]},
  {title:"IT service information",note:"Project, service ownership and lifecycle",fields:[
    {key:"itProjectId",label:"IT Project ID"},{key:"itServiceId",label:"IT Service ID"},{key:"itServiceOwner",label:"IT Service Owner"},{key:"itServiceManager",label:"IT Service Manager"},{key:"lifecycleStage",label:"Lifecycle Stage"}]},
  {title:"Risk, compliance & assurance",note:"Assessment identifiers, statuses and validity dates",fields:[
    {key:"ciaId",label:"CIA ID"},{key:"ciaValidity",label:"CIA Validity",date:true},{key:"socId",label:"SOC ID"},{key:"socValidity",label:"SOC Validity",date:true},
    {key:"itTradeComplianceId",label:"IT Trade Compliance ID"},{key:"soxAssessmentId",label:"SOX Assessment ID"},{key:"soxStatus",label:"SOX Status"},
    {key:"itDrAssuranceId",label:"IT DR Assurance ID"},{key:"itDrRiskAssessmentValidity",label:"IT DR Risk Assessment Validity",date:true},{key:"adqId",label:"ADQ ID"},{key:"adqStatus",label:"ADQ Status"}]}
];
const VALIDITIES = [
  {key:"ciaValidity" as Field,label:"CIA Validity"}, {key:"socValidity" as Field,label:"SOC Validity"},
  {key:"itDrRiskAssessmentValidity" as Field,label:"IT DR Risk Assessment Validity"}
];
function dateOnly(s:string) { if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null; const [y,m,d]=s.split("-").map(Number); const x=new Date(Date.UTC(y,m-1,d)); return x.getUTCFullYear()===y&&x.getUTCMonth()===m-1&&x.getUTCDate()===d?x:null; }
function addMonths(d:Date,n:number) { const x=new Date(d); const day=x.getUTCDate(); x.setUTCDate(1); x.setUTCMonth(x.getUTCMonth()+n); x.setUTCDate(Math.min(day,new Date(Date.UTC(x.getUTCFullYear(),x.getUTCMonth()+1,0)).getUTCDate())); return x; }
function classify(s:string,today:string) { const d=dateOnly(s), now=dateOnly(today); if(!d||!now)return null; const days=Math.round((d.getTime()-now.getTime())/86400000); if(days<0||days<=15)return {tone:"red",days,label:days<0?"Expired":"Due within 15 days"}; if(d<=addMonths(now,3))return {tone:"amber",days,label:"Due within 3 months"}; return {tone:"green",days,label:"Valid beyond 3 months"}; }
function fmt(s:string) { const d=dateOnly(s); return d?new Intl.DateTimeFormat(undefined,{day:"2-digit",month:"short",year:"numeric",timeZone:"UTC"}).format(d):"—"; }
function newId() { return typeof crypto!=="undefined"&&"randomUUID" in crypto?crypto.randomUUID():`${Date.now()}-${Math.random()}`; }

export default function ProductApplicationRegisterPage() {
  const [records,setRecords]=useState<RecordItem[]>([]); const [loaded,setLoaded]=useState(false); const [storageError,setStorageError]=useState("");
  const [today,setToday]=useState(""); const [form,setForm]=useState({...EMPTY}); const [editing,setEditing]=useState<string|null>(null);
  const [formOpen,setFormOpen]=useState(false);
  const [filters,setFilters]=useState({costNetwork:"all",itProjectId:"all",itServiceOwner:"all",itServiceManager:"all",lifecycleStage:"all"});
  const [showRetiredTerminated,setShowRetiredTerminated]=useState(false);
  useEffect(()=>{setToday(new Date().toISOString().slice(0,10));try{const raw=localStorage.getItem(KEY);if(raw){const parsed=JSON.parse(raw);if(!Array.isArray(parsed))throw Error();setRecords(parsed.filter(x=>x&&typeof x.id==="string"));}setLoaded(true);}catch{setStorageError("Saved register data could not be read. Existing data has been left untouched.");}},[]);
  useEffect(()=>{if(!loaded||storageError)return;try{localStorage.setItem(KEY,JSON.stringify(records));}catch{setStorageError("Changes could not be saved to browser storage. Check available storage space.");}},[records,loaded,storageError]);
  const sorted=useMemo(()=>[...records].sort((a,b)=>a.productAppName.localeCompare(b.productAppName,undefined,{sensitivity:"base",numeric:true})),[records]);
  const filterOptions=useMemo(()=>({
    costNetwork:Array.from(new Set(records.map(r=>r.costNetwork.trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base",numeric:true})),
    itProjectId:Array.from(new Set(records.map(r=>r.itProjectId.trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base",numeric:true})),
    itServiceOwner:Array.from(new Set(records.map(r=>r.itServiceOwner.trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base",numeric:true})),
    itServiceManager:Array.from(new Set(records.map(r=>r.itServiceManager.trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base",numeric:true})),
    lifecycleStage:Array.from(new Set(records.map(r=>r.lifecycleStage.trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b,undefined,{sensitivity:"base",numeric:true}))
  }),[records]);
  const filterLabels={costNetwork:"Cost Network",itProjectId:"IT Project ID",itServiceOwner:"IT Service Owner",itServiceManager:"IT Service Manager",lifecycleStage:"Lifecycle Stage"} as const;
  const activeFilters=(Object.keys(filters) as (keyof typeof filters)[]).filter(key=>filters[key]!=="all");
  const isRetiredOrTerminated=(r:RecordItem)=>["retired","terminated"].includes(String(r.lifecycleStage||"").trim().toLowerCase());
  const hiddenLifecycleCount=records.filter(isRetiredOrTerminated).length;
  const visible=useMemo(()=>sorted.filter(r=>(showRetiredTerminated||!isRetiredOrTerminated(r))&&(filters.costNetwork==="all"||r.costNetwork.trim()===filters.costNetwork)&&(filters.itProjectId==="all"||r.itProjectId.trim()===filters.itProjectId)&&(filters.itServiceOwner==="all"||r.itServiceOwner.trim()===filters.itServiceOwner)&&(filters.itServiceManager==="all"||r.itServiceManager.trim()===filters.itServiceManager)&&(filters.lifecycleStage==="all"||r.lifecycleStage.trim()===filters.lifecycleStage)),[sorted,filters,showRetiredTerminated]);
  const clearFilters=()=>setFilters({costNetwork:"all",itProjectId:"all",itServiceOwner:"all",itServiceManager:"all",lifecycleStage:"all"});
  const validity=useMemo(()=>records.filter(r=>!(["retired","terminated"].includes(String(r.lifecycleStage||"").trim().toLowerCase()))).flatMap(r=>VALIDITIES.flatMap(v=>{const value=String(r[v.key]||"");const c=value&&classify(value,today);return c?[{id:r.id+v.key,product:r.productAppName||"Unnamed product/app",field:v.label,value,...c}]:[]})),[records,today]);
  const counts={red:validity.filter(x=>x.tone==="red").length,amber:validity.filter(x=>x.tone==="amber").length,green:validity.filter(x=>x.tone==="green").length};
  const startNew=()=>{setForm({...EMPTY});setEditing(null);setFormOpen(true);};
  const edit=(r:RecordItem)=>{const {id,...values}=r;setForm({...EMPTY,...values});setEditing(id);setFormOpen(true);window.scrollTo({top:0,behavior:"smooth"});};
  const save=(e:React.FormEvent)=>{e.preventDefault();if(!form.productAppName.trim()){alert("Product / App Name is required.");return;}const value={...form,productAppName:form.productAppName.trim().replace(/\s+/g," ")};setRecords(old=>editing?old.map(r=>r.id===editing?{...value,id:editing}:r):[...old,{...value,id:newId()}]);setForm({...EMPTY});setEditing(null);setFormOpen(false);};
  const remove=(r:RecordItem)=>{if(!confirm(`Delete “${r.productAppName}” from the Product & Application Register? This cannot be undone.`))return;setRecords(old=>old.filter(x=>x.id!==r.id));if(editing===r.id){setEditing(null);setForm({...EMPTY});setFormOpen(false);}};
  const update=(key:Field,value:string)=>setForm(old=>({...old,[key]:value}));
  const cols=["Product / App Name","Product / App ID","Business Product Owner","Cost Network","IT Project ID","IT Service ID","IT Service Owner","IT Service Manager","Lifecycle Stage","CIA ID","CIA Validity","SOC ID","SOC Validity","IT Trade Compliance ID","SOX Assessment ID","SOX Status","IT DR Assurance ID","IT DR Risk Assessment Validity","ADQ ID","ADQ Status"];
  const cell=(v:string)=>v?.trim()||"—";
  return <main className="shell"><style jsx global>{`*{box-sizing:border-box}body{margin:0;background:#f3f7fb;color:#18344d;font-family:Arial,Helvetica,sans-serif}`}</style><style jsx>{`
    .shell{min-height:100vh;background:#f3f7fb}.hero{background:linear-gradient(115deg,#073b63,#0c5b91);color:#fff;padding:30px clamp(18px,4vw,56px)}.heroIn,.content{max-width:1600px;margin:auto}.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:#b9d8ef;font-weight:800;margin:0 0 8px}h1{font-size:clamp(25px,3vw,34px);margin:0}.hero p{color:#d9e9f5;font-size:14px;line-height:1.5;margin:10px 0 0}.content{padding:26px clamp(14px,3vw,36px) 56px}.top,.heading{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap}.top{margin-bottom:20px}h2{font-size:19px;color:#123f65;margin:0}.muted,.heading p{font-size:12px;color:#788b9e;margin:5px 0 0}button,input,select{font:inherit}button{cursor:pointer}.primary{border:0;border-radius:9px;padding:11px 16px;background:#126bc0;color:white;font-weight:700}.secondary{border:1px solid #cfdae5;border-radius:9px;padding:10px 14px;background:#fff;color:#31536f;font-weight:700}.stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin-bottom:22px}.stat,.panel{background:#fff;border:1px solid #dce6ef;border-radius:14px;box-shadow:0 3px 12px #153c5b08}.stat{padding:17px 19px}.stat small{color:#71869a;font-weight:700}.stat strong{display:block;font-size:28px;margin-top:7px}.blue{color:#155f9d}.redText{color:#c63737}.amberText{color:#b87808}.greenText{color:#16824b}.panel{padding:20px;margin-bottom:22px}.heading{margin-bottom:16px;align-items:flex-start}.legend{display:flex;gap:8px;flex-wrap:wrap}.legend span,.chip{border-radius:999px;padding:7px 10px;font-size:11px;font-weight:700}.legend .r{background:#fff0f0;color:#a92d2d}.legend .a{background:#fff7e7;color:#97620b}.legend .g{background:#eaf8f0;color:#167346}.validity{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:13px}.bucket{border:1px solid #e1e9f0;border-radius:11px;padding:13px;min-width:0}.bucket.red{border-top:3px solid #dc4545;background:#fffafa}.bucket.amber{border-top:3px solid #e4a329;background:#fffdf8}.bucket.green{border-top:3px solid #29a365;background:#fbfefc}.bucket h3{font-size:13px;margin:0 0 10px}.items{display:grid;gap:8px;max-height:260px;overflow:auto}.item{border:1px solid #e5ebf0;border-radius:8px;background:#fff;padding:9px;font-size:11px}.item b{display:block;color:#254761;font-size:12px}.item span{display:block;color:#718397;margin-top:4px}.item strong{display:block;margin-top:5px}.empty{text-align:center;padding:16px 8px;color:#8a9aaa;font-size:12px}.toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:12px}.toolbar select{flex:1 1 175px;font-family:inherit;font-size:14px;font-weight:500;line-height:1.4;padding:9px 12px;height:42px;color:#243f56}.toolbar input,.toolbar select,.field input{border:1px solid #d5e0e9;border-radius:8px;padding:10px 11px;background:#fff;color:#243f56;min-width:0}.activeFilters{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin:0 0 12px}.filterChip{display:inline-flex;align-items:center;gap:7px;padding:6px 9px;border:1px solid #cbddeb;border-radius:999px;background:#f2f7fb;color:#31536f;font-size:11px;font-weight:700}.filterChip button{border:0;background:transparent;color:#31536f;font-weight:800;padding:0 1px;font-size:14px;line-height:1}.lifecycleToggle{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border:1px solid #d5e0e9;border-radius:8px;background:#fff;color:#31536f;font-size:12px;font-weight:700;white-space:nowrap}.lifecycleToggle input{width:15px;height:15px;accent-color:#b85b64;margin:0}.clearFilters{border:1px solid #cfdae5;border-radius:8px;padding:9px 12px;background:#fff;color:#31536f;font-size:12px;font-weight:700}.resultCount{font-size:12px;color:#71869a;margin-top:5px}.tableWrap{overflow:auto;max-height:min(70vh,720px);border:1px solid #e1e9f0;border-radius:10px;position:relative;overscroll-behavior:contain}table{border-collapse:separate;border-spacing:0;width:100%;min-width:2300px;font-size:12px}th{position:sticky;top:0;z-index:3;background:#f0f5f9;color:#45627b;text-align:left;padding:11px 12px;white-space:nowrap;border-bottom:1px solid #dce6ee}thead th:first-child{position:sticky;left:0;top:0;z-index:5;background:#f0f5f9}td{padding:11px 12px;border-bottom:1px solid #edf1f5;color:#405b72;max-width:220px;vertical-align:top;overflow-wrap:anywhere}tbody tr:hover td{background:#f9fbfd}
    /* Distinct rose highlight for retired and terminated products/apps */
    tbody tr.retiredRow td{background:#F8ECEE;color:#5F4549}
    tbody tr.retiredRow:hover td{background:#F1DDE0}
    tbody tr.retiredRow .product{background:#F3E1E4;color:#74464B;box-shadow:inset 4px 0 0 #C36A73,2px 0 5px #18344d12}
    tbody tr.retiredRow .lifecycleBadge{display:inline-block;padding:4px 8px;border-radius:6px;background:#B85B64;color:#fff;font-size:11px;font-weight:800;line-height:1.2}
    .product{position:sticky;left:0;z-index:2;background:#fff;font-weight:800;color:#164d79;min-width:285px;width:285px;max-width:285px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;overflow-wrap:normal;box-shadow:2px 0 5px #18344d12}.nowrap{white-space:nowrap;overflow-wrap:normal;word-break:normal;max-width:none}.actions{display:flex;gap:7px;white-space:nowrap}.edit,.delete{border-radius:7px;padding:6px 9px;font-size:11px;font-weight:700}.edit{border:1px solid #cfe0ef;color:#155f9d;background:#f4f9fd}.delete{border:1px solid #f1d4d4;color:#bd3737;background:#fff8f8}.date{display:inline-block;padding:0;border:0;border-radius:0;background:transparent;font-size:12px;font-weight:700;line-height:1.4;white-space:nowrap}.date.red{color:#B45353}.date.amber{color:#A87922}.date.green{color:#39805D}.formPanel{border-color:#b9d7ed;background:#fbfdff}.formGrid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.group{border:1px solid #e2eaf1;background:#fff;border-radius:10px;padding:14px;min-width:0}.group h3{font-size:13px;color:#245579;margin:0}.group p{font-size:11px;color:#8a9aaa;margin:4px 0 12px}.fields{display:grid;gap:10px}.field{display:grid;gap:5px}.field label{font-size:11px;color:#526b80;font-weight:700}.field input{width:100%;font-size:12px}.formActions{display:flex;justify-content:flex-end;gap:9px;margin-top:16px}.notice{background:#fff5f5;border:1px solid #f0cccc;border-radius:9px;padding:10px 12px;color:#9d3030;font-size:12px;margin-bottom:15px}.note{font-size:11px;color:#8797a6;line-height:1.5;margin-top:12px}@media(max-width:900px){.stats{grid-template-columns:repeat(2,minmax(0,1fr))}.formGrid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.validity,.formGrid{grid-template-columns:1fr}.panel{padding:14px}}
  `}</style>
  <nav aria-label="Main navigation" style={{display:"flex",gap:8,flexWrap:"wrap",padding:"16px clamp(14px,3vw,36px)",background:"#FFFFFF",borderBottom:"1px solid #DCE6EF"}}>
    <a href="/" style={{display:"inline-block",padding:"10px 16px",borderRadius:9,border:"1px solid #C8D8E6",background:"#FFFFFF",color:"#164D79",textDecoration:"none",fontWeight:700,fontSize:14}}>Release Tracker</a>
    <a href="/product-register" aria-current="page" style={{display:"inline-block",padding:"10px 16px",borderRadius:9,background:"#013F6A",color:"#FFFFFF",textDecoration:"none",fontWeight:700,fontSize:14}}>Product &amp; App Register</a>
  </nav>
  <header className="hero"><div className="heroIn"><p className="eyebrow">Portfolio governance</p><h1>Product &amp; Application Register</h1><p>Maintain product ownership, IT service references, lifecycle information and compliance validity dates in one dedicated register.</p></div></header>
  <div className="content">
    {storageError&&<div className="notice" role="alert">{storageError}</div>}
    <div className="top"><div><h2>Portfolio Overview</h2><div className="muted">Products, applications and upcoming validity dates.</div></div><button className="primary" onClick={()=>{setForm({...EMPTY});setEditing(null);setFormOpen(true);}}>＋ Add Product / App</button></div>
    <section className="stats"><div className="stat"><small>Products / Apps</small><strong className="blue">{records.length}</strong><div className="muted">Total registered records</div></div><div className="stat"><small>Red · Action Required</small><strong className="redText">{counts.red}</strong><div className="muted">Expired or due within 15 days</div></div><div className="stat"><small>Amber · Upcoming</small><strong className="amberText">{counts.amber}</strong><div className="muted">After 15 days, within 3 months</div></div><div className="stat"><small>Green · Valid</small><strong className="greenText">{counts.green}</strong><div className="muted">More than 3 months remaining</div></div></section>
    <section className="panel"><div className="heading"><div><h2>Validity Monitor</h2><p>Each entered validity date is assessed separately across all products and apps.</p></div><div className="legend"><span className="r">Red · 0–15 days / expired</span><span className="a">Amber · 16 days to 3 months</span><span className="g">Green · More than 3 months</span></div></div>
      <div className="validity">{(["red","amber","green"] as const).map(tone=>{const items=validity.filter(x=>x.tone===tone);return <div className={`bucket ${tone}`} key={tone}><h3>{tone==="red"?"Immediate Attention":tone==="amber"?"Upcoming Renewals":"Valid Beyond 3 months"} · {items.length}</h3><div className="items">{items.length?items.map(x=><div className="item" key={x.id}><b>{x.product}</b><span>{x.field}</span><strong className={`${tone}Text`}>{fmt(x.value)} · {x.days<0?`${Math.abs(x.days)} days overdue`:x.days===0?"Expires today":`${x.days} days remaining`}</strong></div>):<div className="empty">No dates in this category</div>}</div></div>})}</div>
      <div className="note">Monitor includes CIA Validity, SOC Validity and IT DR Risk Assessment Validity. Blank dates are excluded, not treated as valid.</div>
    </section>
    {formOpen&&<section className="panel formPanel" id="product-app-form"><div className="heading"><div><h2>{editing?"Edit product / app":"Add product / app"}</h2><p>Only Product / App Name is mandatory. Other fields can be completed later.</p></div><button className="secondary" onClick={()=>{setFormOpen(false);setEditing(null);}}>Close</button></div>
      <form onSubmit={save}><div className="formGrid">{GROUPS.map(g=><div className="group" key={g.title}><h3>{g.title}</h3><p>{g.note}</p><div className="fields">{g.fields.map(f=><div className="field" key={f.key}><label htmlFor={f.key}>{f.label}{f.key==="productAppName"?" *":""}</label><input id={f.key} type={f.date?"date":"text"} value={form[f.key]} required={f.key==="productAppName"} onChange={e=>update(f.key,e.target.value)} placeholder={f.date?undefined:`Enter ${f.label.toLowerCase()}`}/></div>)}</div></div>)}</div><div className="formActions"><button type="button" className="secondary" onClick={()=>{setForm({...EMPTY});setEditing(null);setFormOpen(false);}}>Cancel</button><button className="primary" type="submit">{editing?"Save Changes":"Save Product / App"}</button></div></form>
    </section>}
    <section className="panel"><div className="heading"><div><h2>Product / Application Details</h2><p className="resultCount">Showing {visible.length} of {records.length} {records.length===1?"record":"records"}{!showRetiredTerminated&&hiddenLifecycleCount?` · ${hiddenLifecycleCount} retired / terminated hidden`:""}{activeFilters.length?` · ${activeFilters.length} active ${activeFilters.length===1?"filter":"filters"}`:" · No filters applied"}</p></div></div>
      <div className="toolbar">
        {(Object.keys(filterLabels) as (keyof typeof filterLabels)[]).map(key=><select key={key} aria-label={`Filter by ${filterLabels[key]}`} value={filters[key]} onChange={e=>setFilters(old=>({...old,[key]:e.target.value}))}><option value="all">All {filterLabels[key]}</option>{filterOptions[key].map(value=><option key={value} value={value}>{value}</option>)}</select>)}
        <label className="lifecycleToggle"><input type="checkbox" checked={showRetiredTerminated} onChange={e=>setShowRetiredTerminated(e.target.checked)}/> Show Retired / Terminated</label>
        <button type="button" className="clearFilters" onClick={clearFilters} disabled={!activeFilters.length}>Clear all filters</button>
      </div>
      {(activeFilters.length>0||showRetiredTerminated)&&<div className="activeFilters" aria-label="Active filters">{activeFilters.map(key=><span className="filterChip" key={key}>{filterLabels[key]}: {filters[key]}<button type="button" aria-label={`Remove ${filterLabels[key]} filter`} onClick={()=>setFilters(old=>({...old,[key]:"all"}))}>×</button></span>)}{showRetiredTerminated&&<span className="filterChip">Retired / Terminated: shown<button type="button" aria-label="Hide retired and terminated products" onClick={()=>setShowRetiredTerminated(false)}>×</button></span>}</div>}
      <div className="tableWrap"><table><thead><tr>{cols.map(c=><th key={c}>{c}</th>)}<th>Actions</th></tr></thead><tbody>{visible.length?visible.map(r=><tr key={r.id} className={["retired","terminated"].includes(String(r.lifecycleStage||"").trim().toLowerCase())?"retiredRow":""}>
        <td className="product">{r.productAppName||"—"}</td><td className="nowrap">{r.productAppId||"—"}</td><td>{r.businessProductOwner||"—"}</td><td>{r.costNetwork||"—"}</td><td className="nowrap">{r.itProjectId||"—"}</td><td className="nowrap">{r.itServiceId||"—"}</td><td>{r.itServiceOwner||"—"}</td><td>{r.itServiceManager||"—"}</td><td>{["retired","terminated"].includes(String(r.lifecycleStage||"").trim().toLowerCase())?<span className="lifecycleBadge">{r.lifecycleStage}</span>:(r.lifecycleStage||"—")}</td><td className="nowrap">{r.ciaId||"—"}</td><td className="nowrap"><DateCell value={r.ciaValidity} today={today}/></td><td className="nowrap">{r.socId||"—"}</td><td className="nowrap"><DateCell value={r.socValidity} today={today}/></td><td className="nowrap">{r.itTradeComplianceId||"—"}</td><td className="nowrap">{r.soxAssessmentId||"—"}</td><td>{r.soxStatus||"—"}</td><td className="nowrap">{r.itDrAssuranceId||"—"}</td><td className="nowrap"><DateCell value={r.itDrRiskAssessmentValidity} today={today}/></td><td className="nowrap">{r.adqId||"—"}</td><td>{r.adqStatus||"—"}</td><td><div className="actions"><button className="edit" onClick={()=>edit(r)}>Edit</button><button className="delete" onClick={()=>remove(r)}>Delete</button></div></td>
      </tr>):<tr><td colSpan={21}><div className="empty">{records.length?(hiddenLifecycleCount&&!showRetiredTerminated?"No active products match the selected filters. Retired / Terminated products are currently hidden.":"No records match the selected filters."):"No products or apps yet. Select Add Product / App to create the first record."}</div></td></tr>}</tbody></table></div>
      <div className="note">Scroll horizontally to view all fields. Data is saved in this browser only; clearing browser storage will remove the register unless you keep a separate backup.</div>
    </section>
  </div></main>;
}
function DateCell({value,today}:{value:string;today:string}) {
  if (!value) return <span className="muted">Not entered</span>;
  const c = classify(value,today);
  if (!c) return <span className="muted">Invalid date</span>;
  const dateColor = c.tone === "red" ? "#B45353" : c.tone === "amber" ? "#A87922" : "#39805D";
  return (
    <span
      className={`date ${c.tone}`}
      style={{ color: dateColor, WebkitTextFillColor: dateColor, fontWeight: 700, whiteSpace: "nowrap", display: "inline-block" }}
      title={c.label}
      aria-label={`${fmt(value)}: ${c.label}`}
    >
      {fmt(value)}
    </span>
  );
}
