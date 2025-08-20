/* Golden Eats POS – Offline-first (LocalStorage) */

// ---------- Utilities ----------
const $ = sel => document.querySelector(sel);
const $$ = sel => document.querySelectorAll(sel);
const fmt = n => (+n).toFixed(2);
const todayISO = () => new Date().toISOString().slice(0,10);
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const LS = {
  get: (k, d) => JSON.parse(localStorage.getItem(k) || JSON.stringify(d)),
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
  del: (k) => localStorage.removeItem(k)
};

// Storage keys
const K = {
  CATS: 'ge_cats',
  PRODS: 'ge_prods',
  CUSTS: 'ge_custs',
  ORDERS: 'ge_orders',
  BIZ: 'ge_biz',
  CART: 'ge_cart_draft' // autosave POS invoice draft
};

// Seed business profile
if(!LS.get(K.BIZ,null)){
  LS.set(K.BIZ,{
    name:'Golden Eats',
    email:'goldeneats07@gmsil.com',
    phone:'0907453590',
    location:'Addis Ababa, Oromia, Baale, Dallo-Manna'
  });
}

// Data access
const DB = {
  cats: () => LS.get(K.CATS, []),
  saveCats: arr => LS.set(K.CATS, arr),

  prods: () => LS.get(K.PRODS, []),
  saveProds: arr => LS.set(K.PRODS, arr),

  custs: () => LS.get(K.CUSTS, []),
  saveCusts: arr => LS.set(K.CUSTS, arr),

  orders: () => LS.get(K.ORDERS, []),
  saveOrders: arr => LS.set(K.ORDERS, arr),

  biz: () => LS.get(K.BIZ, {}),
  saveBiz: o => LS.set(K.BIZ, o),

  draft: () => LS.get(K.CART, {items:[], phone:'', payment:'Cash'}),
  saveDraft: o => LS.set(K.CART, o),
  clearDraft: () => LS.del(K.CART),
};

// ---------- Navigation ----------
$("#year").textContent = new Date().getFullYear();

$("#navTabs").addEventListener("click", e=>{
  const btn = e.target.closest("button[data-page]");
  if(!btn) return;
  $$("#navTabs button").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  const id = btn.dataset.page;
  $$("#pages .page").forEach(p=>p.classList.remove("visible"));
  $("#page-"+id).classList.add("visible");
  // refresh page content
  if(id==='dashboard') renderDashboard();
  if(id==='categories') renderCats();
  if(id==='products'){ fillCatSelect(); renderProds(); }
  if(id==='customers') renderCusts();
  if(id==='pos'){ refreshProductDatalist(); loadDraftToUI(); renderCart(); }
  if(id==='orders') renderOrders();
  if(id==='settings') loadBizToUI();
});

// ---------- Categories ----------
function renderCats(){
  const rows = DB.cats().map((c,i)=>`
    <tr>
      <td>${i+1}</td>
      <td>${c.name}</td>
      <td>
        <button data-act="edit" data-id="${c.id}" class="ghost">✏️ Edit</button>
        <button data-act="del" data-id="${c.id}" class="danger">✖ Delete</button>
      </td>
    </tr>`).join("") || `<tr><td colspan="3">No categories yet.</td></tr>`;
  $("#catRows").innerHTML = rows;
}
$("#catForm").addEventListener("submit", e=>{
  e.preventDefault();
  const id = $("#catId").value || uid();
  const name = $("#catName").value.trim();
  if(!name) return;
  const cats = DB.cats();
  const idx = cats.findIndex(c=>c.id===id);
  if(idx>-1) cats[idx].name = name;
  else cats.push({id, name});
  DB.saveCats(cats);
  $("#catForm").reset();
  $("#catId").value = "";
  renderCats(); updateKPIs();
});
$("#catReset").onclick = ()=>{$("#catForm").reset(); $("#catId").value="";};
$("#catRows").addEventListener("click", e=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  const id = btn.dataset.id;
  const cats = DB.cats();
  const item = cats.find(c=>c.id===id);
  if(btn.dataset.act==='edit'){
    $("#catId").value = item.id;
    $("#catName").value = item.name;
  }else if(btn.dataset.act==='del'){
    if(confirm("Delete category? Products linked will remain but show empty category.")){
      DB.saveCats(cats.filter(c=>c.id!==id));
      renderCats(); updateKPIs(); fillCatSelect();
    }
  }
});

// ---------- Products ----------
function fillCatSelect(){
  const opts = DB.cats().map(c=>`<option value="${c.id}">${c.name}</option>`).join("");
  $("#prodCategory").innerHTML = `<option value="">Select category</option>${opts}`;
}
function renderProds(){
  const cats = DB.cats();
  const rows = DB.prods().map((p,i)=>{
    const cat = cats.find(c=>c.id===p.categoryId)?.name || "—";
    const img = p.image ? `<img src="${p.image}" alt="" style="width:42px;height:42px;border-radius:8px;object-fit:cover">` : "—";
    return `<tr>
      <td>${i+1}</td><td>${img}</td><td>${p.name}</td><td>${cat}</td><td>${fmt(p.price)}</td>
      <td>
        <button class="ghost" data-act="edit" data-id="${p.id}">✏️ Edit</button>
        <button class="danger" data-act="del" data-id="${p.id}">✖ Delete</button>
      </td></tr>`;
  }).join("") || `<tr><td colspan="6">No products yet.</td></tr>`;
  $("#prodRows").innerHTML = rows;
  refreshProductDatalist();
}
$("#prodForm").addEventListener("submit", async e=>{
  e.preventDefault();
  const id = $("#prodId").value || uid();
  const name = $("#prodName").value.trim();
  const categoryId = $("#prodCategory").value;
  const price = parseFloat($("#prodPrice").value||0);
  let image = null;
  const file = $("#prodImage").files[0];
  if(file){
    image = await fileToDataURL(file);
  }
  const arr = DB.prods();
  const idx = arr.findIndex(p=>p.id===id);
  if(idx>-1){
    Object.assign(arr[idx], {name, categoryId, price, image: image ?? arr[idx].image});
  }else{
    arr.push({id, name, categoryId, price, image});
  }
  DB.saveProds(arr);
  $("#prodForm").reset(); $("#prodId").value="";
  renderProds(); updateKPIs();
});
$("#prodReset").onclick = ()=>{$("#prodForm").reset(); $("#prodId").value="";};
$("#prodRows").addEventListener("click", e=>{
  const btn = e.target.closest("button");
  if(!btn) return;
  const id = btn.dataset.id;
  const arr = DB.prods();
  const item = arr.find(p=>p.id===id);
  if(btn.dataset.act==='edit'){
    $("#prodId").value = item.id;
    $("#prodName").value = item.name;
    $("#prodCategory").value = item.categoryId;
    $("#prodPrice").value = item.price;
    $("#navTabs [data-page='products']").scrollIntoView({behavior:'smooth',block:'start'});
  }else if(btn.dataset.act==='del'){
    if(confirm("Delete this product?")){
      DB.saveProds(arr.filter(p=>p.id!==id));
      renderProds(); updateKPIs(); refreshProductDatalist();
    }
  }
});

// helper
function fileToDataURL(file){
  return new Promise(res=>{
    const fr = new FileReader();
    fr.onload = e=>res(e.target.result);
    fr.readAsDataURL(file);
  });
}
function refreshProductDatalist(){
  const list = DB.prods().map(p=>`<option value="${p.name}">${p.name}</option>`).join("");
  $("#productsList").innerHTML = list;
}

// ---------- Customers ----------
function renderCusts(){
  const rows = DB.custs().map((c,i)=>`
  <tr>
    <td>${i+1}</td><td>${c.name}</td><td>${c.phone||'—'}</td>
    <td>${c.email||'—'}</td><td>${c.location||'—'}</td>
    <td>
      <button class="ghost" data-act="edit" data-id="${c.id}">✏️</button>
      <button class="danger" data-act="del" data-id="${c.id}">✖</button>
    </td>
  </tr>`).join("") || `<tr><td colspan="6">No customers yet.</td></tr>`;
  $("#custRows").innerHTML = rows;
}
$("#custForm").addEventListener("submit", e=>{
  e.preventDefault();
  const id = $("#custId").value || uid();
  const name = $("#custName").value.trim();
  const phone = $("#custPhone").value.trim();
  const email = $("#custEmail").value.trim();
  const location = $("#custLocation").value.trim();
  if(!name) return;
  const arr = DB.custs();
  const i = arr.findIndex(x=>x.id===id);
  if(i>-1) Object.assign(arr[i], {name, phone, email, location});
  else arr.push({id,name,phone,email,location});
  DB.saveCusts(arr);
  $("#custForm").reset(); $("#custId").value="";
  renderCusts(); updateKPIs();
});
$("#custReset").onclick = ()=>{$("#custForm").reset(); $("#custId").value="";};
$("#custRows").addEventListener("click", e=>{
  const b=e.target.closest("button"); if(!b) return;
  const id=b.dataset.id; const arr=DB.custs(); const it=arr.find(x=>x.id===id);
  if(b.dataset.act==='edit'){
    $("#custId").value=it.id; $("#custName").value=it.name;
    $("#custPhone").value=it.phone||''; $("#custEmail").value=it.email||'';
    $("#custLocation").value=it.location||'';
  }else if(b.dataset.act==='del'){
    if(confirm("Delete customer?")){
      DB.saveCusts(arr.filter(x=>x.id!==id)); renderCusts(); updateKPIs();
    }
  }
});

// ---------- POS / Cart ----------
const cart = {
  items: [],
  total(){ return this.items.reduce((s,i)=>s+i.price*i.qty,0); }
};

function loadDraftToUI(){
  const d = DB.draft();
  cart.items = d.items || [];
  $("#orderPhone").value = d.phone || "";
  $("#orderPayment").value = d.payment || "Cash";
}
function saveDraftFromUI(){
  DB.saveDraft({items: cart.items, phone: $("#orderPhone").value.trim(), payment: $("#orderPayment").value});
  alert("Draft saved locally.");
}
$("#saveDraftBtn").onclick = saveDraftFromUI;

$("#posAddBtn").addEventListener("click", ()=>{
  const name = $("#posSearch").value.trim();
  const qty = parseInt($("#posQty").value||1,10);
  if(!name || qty<1) return;
  const prod = DB.prods().find(p=>p.name.toLowerCase()===name.toLowerCase());
  if(!prod){ alert("Product not found. Add it in Products tab first."); return; }
  const existing = cart.items.find(i=>i.productId===prod.id);
  if(existing) existing.qty += qty;
  else cart.items.push({productId:prod.id,name:prod.name,price:+prod.price,qty});
  $("#posSearch").value = "";
  $("#posQty").value = 1;
  renderCart();
  DB.saveDraft({items: cart.items, phone: $("#orderPhone").value.trim(), payment: $("#orderPayment").value});
});

function renderCart(){
  const rows = cart.items.map((it,idx)=>`
    <tr>
      <td>${it.name}</td>
      <td>${fmt(it.price)}</td>
      <td>
        <div class="row">
          <button class="ghost" data-act="minus" data-i="${idx}">–</button>
          <input data-i="${idx}" class="qty-input" value="${it.qty}" style="width:54px;text-align:center">
          <button class="ghost" data-act="plus" data-i="${idx}">+</button>
        </div>
      </td>
      <td>${fmt(it.price*it.qty)}</td>
      <td><button class="danger" data-act="rm" data-i="${idx}">✖</button></td>
    </tr>`).join("") || `<tr><td colspan="5">No items. Search and add above.</td></tr>`;
  $("#cartRows").innerHTML = rows;
  $("#cartTotal").innerHTML = `<b>${fmt(cart.total())}</b>`;
}

$("#cartRows").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  const i = +b.dataset.i;
  if(b.dataset.act==='minus'){ cart.items[i].qty=Math.max(1,cart.items[i].qty-1); }
  if(b.dataset.act==='plus'){ cart.items[i].qty+=1; }
  if(b.dataset.act==='rm'){ cart.items.splice(i,1); }
  renderCart(); DB.saveDraft({items: cart.items, phone: $("#orderPhone").value.trim(), payment: $("#orderPayment").value});
});
$("#cartRows").addEventListener("change", e=>{
  const el=e.target; if(!el.classList.contains("qty-input")) return;
  const i=+el.dataset.i; cart.items[i].qty=Math.max(1, parseInt(el.value||1,10));
  renderCart(); DB.saveDraft({items: cart.items, phone: $("#orderPhone").value.trim(), payment: $("#orderPayment").value});
});

// Place order flow
$("#placeOrderBtn").addEventListener("click", ()=>{
  if(cart.items.length===0){ alert("Add at least one item."); return; }
  const phone = $("#orderPhone").value.trim();
  const pay = $("#orderPayment").value;
  // find or create customer by phone
  let cust = null;
  if(phone){
    cust = DB.custs().find(c=>c.phone===phone) || null;
  }
  if(!cust){
    // ask to create
    const dlg = $("#custModal");
    dlg.showModal();
    $("#mPhone").value = phone;
    $("#mName").focus();
    $("#mSave").onclick = ()=>{
      const name = $("#mName").value.trim();
      const c = {id:uid(), name: name || ("Guest-"+phone), phone: $("#mPhone").value.trim(), email: $("#mEmail").value.trim(), location: $("#mLocation").value.trim()};
      const arr = DB.custs(); arr.push(c); DB.saveCusts(arr);
      dlg.close(); finalizeOrder(c, pay);
    };
    dlg.addEventListener("close", ()=>{ /* no-op */ }, {once:true});
  }else{
    finalizeOrder(cust, pay);
  }
});

function finalizeOrder(customer, payment){
  const id = uid();
  const track = "GE-" + id.slice(-6).toUpperCase();
  const date = new Date().toISOString();
  const items = cart.items.map(i=>({productId:i.productId,name:i.name,price:i.price,qty:i.qty}));
  const total = items.reduce((s,i)=>s+i.price*i.qty,0);
  const order = {id, trackingNo: track, date, paymentMode: payment, customerId: customer.id, items, total};
  const arr = DB.orders(); arr.unshift(order); DB.saveOrders(arr);
  DB.clearDraft();
  // fill invoice for print
  fillInvoice(order, customer);
  // clear UI cart
  cart.items = [];
  renderCart(); updateKPIs(); renderOrders(); renderDashboard();
  alert("Order placed!");
}

function fillInvoice(order, customer){
  $("#invNo").textContent = order.trackingNo;
  $("#invDate").textContent = new Date(order.date).toLocaleString();
  $("#invCustomer").textContent = `${customer.name} (${customer.phone || "-"})`;
  $("#invRows").innerHTML = order.items.map(i=>`
    <tr><td>${i.name}</td><td>${fmt(i.price)}</td><td>${i.qty}</td><td>${fmt(i.price*i.qty)}</td></tr>
  `).join("");
  $("#invTotal").textContent = fmt(order.total);
  $(".print-area").classList.add("visible");
}

$("#printBtn").addEventListener("click", ()=>{
  // if there is a recently placed order in table, use it, else try draft
  const orders = DB.orders();
  if(orders[0]){
    const cust = DB.custs().find(c=>c.id===orders[0].customerId) || {name:"—",phone:"—"};
    fillInvoice(orders[0], cust);
  }
  window.print(); // users can “Save as PDF”
});

$("#viewInvoicesBtn").onclick = ()=>{ 
  $$("#navTabs button").forEach(b=>b.classList.remove("active"));
  $("#navTabs [data-page='orders']").classList.add("active");
  $$("#pages .page").forEach(p=>p.classList.remove("visible"));
  $("#page-orders").classList.add("visible");
  renderOrders();
};

// ---------- Orders list ----------
function renderOrders(){
  const rows = DB.orders().map(o=>{
    const cust = DB.custs().find(c=>c.id===o.customerId);
    return `<tr>
      <td>${o.trackingNo}</td>
      <td>${new Date(o.date).toLocaleString()}</td>
      <td>${cust?cust.name:'—'} ${cust?.phone?`(${cust.phone})`:''}</td>
      <td>${o.paymentMode}</td>
      <td>${fmt(o.total)}</td>
      <td>
        <button class="ghost" data-act="view" data-id="${o.id}">👁️ View</button>
        <button class="outline" data-act="print" data-id="${o.id}">🖨️ Print</button>
        <button class="danger" data-act="del" data-id="${o.id}">✖ Delete</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="6">No orders yet.</td></tr>`;
  $("#orderRows").innerHTML = rows;
}
$("#orderRows").addEventListener("click", e=>{
  const b = e.target.closest("button"); if(!b) return;
  const id = b.dataset.id;
  const arr = DB.orders();
  const order = arr.find(o=>o.id===id);
  if(b.dataset.act==='view'){
    const cust = DB.custs().find(c=>c.id===order.customerId) || {name:'—'};
    fillInvoice(order, cust);
    alert("Scroll to the invoice preview near the POS section or use Print.");
  }else if(b.dataset.act==='print'){
    const cust = DB.custs().find(c=>c.id===order.customerId) || {name:'—'};
    fillInvoice(order, cust);
    window.print();
  }else if(b.dataset.act==='del'){
    if(confirm("Delete this order?")){
      DB.saveOrders(arr.filter(o=>o.id!==id)); renderOrders(); updateKPIs(); renderDashboard();
    }
  }
});

// Filtering
$("#filterBtn").onclick = ()=>{
  const from = $("#filterFrom").value ? new Date($("#filterFrom").value) : null;
  const to = $("#filterTo").value ? new Date($("#filterTo").value+"T23:59:59") : null;
  const pay = $("#filterPayment").value;
  const filtered = DB.orders().filter(o=>{
    const d = new Date(o.date);
    const okDate = (!from || d>=from) && (!to || d<=to);
    const okPay = !pay || o.paymentMode===pay;
    return okDate && okPay;
  });
  const rows = filtered.map(o=>{
    const cust = DB.custs().find(c=>c.id===o.customerId);
    return `<tr>
      <td>${o.trackingNo}</td>
      <td>${new Date(o.date).toLocaleString()}</td>
      <td>${cust?cust.name:'—'} ${cust?.phone?`(${cust.phone})`:''}</td>
      <td>${o.paymentMode}</td>
      <td>${fmt(o.total)}</td>
      <td>
        <button class="ghost" data-act="view" data-id="${o.id}">👁️</button>
        <button class="outline" data-act="print" data-id="${o.id}">🖨️</button>
      </td>
    </tr>`;
  }).join("") || `<tr><td colspan="6">No results.</td></tr>`;
  $("#orderRows").innerHTML = rows;
};

// ---------- Dashboard ----------
function updateKPIs(){
  $("#kpiCategories").textContent = DB.cats().length;
  $("#kpiProducts").textContent = DB.prods().length;
  $("#kpiCustomers").textContent = DB.custs().length;
  const today = todayISO();
  const count = DB.orders().filter(o=>o.date.slice(0,10)===today).length;
  $("#kpiTodayOrders").textContent = count;
}
function renderDashboard(){
  updateKPIs();
  const rows = DB.orders().slice(0,8).map(o=>{
    const cust = DB.custs().find(c=>c.id===o.customerId);
    return `<tr>
      <td>${o.trackingNo}</td>
      <td>${new Date(o.date).toLocaleString()}</td>
      <td>${cust?cust.name:'—'}</td>
      <td>${o.paymentMode}</td>
      <td>${fmt(o.total)}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="5">No recent orders.</td></tr>`;
  $("#dashboardRecentOrders").innerHTML = rows;
}

// ---------- Settings (Business profile + import/export) ----------
function loadBizToUI(){
  const b = DB.biz();
  $("#bizName").value = b.name || "";
  $("#bizEmail").value = b.email || "";
  $("#bizPhone").value = b.phone || "";
  $("#bizLocation").value = b.location || "";
}
$("#bizForm").addEventListener("submit", e=>{
  e.preventDefault();
  DB.saveBiz({
    name: $("#bizName").value,
    email: $("#bizEmail").value,
    phone: $("#bizPhone").value,
    location: $("#bizLocation").value
  });
  alert("Profile saved.");
});

$("#exportBtn").onclick = ()=>{
  const data = {
    cats: DB.cats(),
    prods: DB.prods(),
    custs: DB.custs(),
    orders: DB.orders(),
    biz: DB.biz()
  };
  const blob = new Blob([JSON.stringify(data,null,2)], {type:'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'golden-eats-pos-backup.json';
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
};
$("#importFile").addEventListener("change", async e=>{
  const file = e.target.files[0]; if(!file) return;
  const text = await file.text();
  try{
    const data = JSON.parse(text);
    if(data.cats) DB.saveCats(data.cats);
    if(data.prods) DB.saveProds(data.prods);
    if(data.custs) DB.saveCusts(data.custs);
    if(data.orders) DB.saveOrders(data.orders);
    if(data.biz) DB.saveBiz(data.biz);
    alert("Import successful.");
    renderCats(); renderProds(); renderCusts(); renderOrders(); renderDashboard(); updateKPIs();
  }catch(err){
    alert("Invalid JSON file.");
  }
});
$("#wipeBtn").onclick = ()=>{
  if(confirm("This will erase local data on this device only. Continue?")){
    [K.CATS,K.PRODS,K.CUSTS,K.ORDERS,K.CART].forEach(LS.del);
    renderCats(); renderProds(); renderCusts(); renderOrders(); renderDashboard(); updateKPIs();
  }
};

// ---------- Boot ----------
renderDashboard(); // initial
fillCatSelect();
renderProds();
renderCusts();
refreshProductDatalist();
loadDraftToUI();
renderCart();

/* Notes:
 - “Download as PDF” is done via your browser’s Print dialog → Save as PDF.
 - Everything is stored locally (offline) using LocalStorage. Use Export/Import for backups or syncing.
 - You can connect to an online DB later by replacing the LS.* calls with your API requests.
*/
