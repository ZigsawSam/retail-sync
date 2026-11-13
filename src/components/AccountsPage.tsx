"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useApp } from "../context/AppContext";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
type Supplier = { id: string; name: string; phone?: string | null; address?: string | null; gst_number?: string | null; owner_name?: string | null; email?: string | null; alternate_phone?: string | null; city?: string | null; state?: string | null; postal_code?: string | null; country?: string | null; notes?: string | null };
type Purchase = { id: string; supplier_id: string | null; supplier_name: string; invoice_number?: string | null; total_amount: number; paid_amount: number; due_amount: number; payment_method: string; timestamp: string; transporter_id?: string | null; transporter_name?: string | null; freight_amount?: number; freight_paid_amount?: number; freight_due_amount?: number; delivery_mode?: string | null };
type Transporter = { id: string; name: string; phone?: string | null };
type PurchaseLine = { productId: string; name: string; quantity: number; purchasePrice: number; purchaseQuantity?: number; purchaseUnit?: string; baseUnit?: string; unitsPerPurchaseUnit?: number; purchaseUnitCost?: number; newProduct?: { name:string; category:string; barcode:string; sellingPrice:number; purchaseUnit:string; baseUnit:string; unitsPerPurchaseUnit:number } };
type DueCustomer = { id: string; name: string; phone: string; due: number };

const inputClass = "w-full px-3 py-2.5 border-2 border-black bg-white text-sm font-bold text-black focus:outline-none";
const buttonClass = "px-4 py-2.5 border-2 border-black bg-[#FFC300] text-black text-xs font-black uppercase shadow-[2px_2px_0_#000] hover:translate-y-[-1px]";

export default function AccountsPage() {
  const { currency, products, refreshData } = useApp();
  const [productSource, setProductSource] = useState<"existing" | "new" | "">("");
  const [showProductCreator, setShowProductCreator] = useState(false);
  const [newProductMode, setNewProductMode] = useState<"quick" | "bulk" | "csv">("quick");
  const [newProductName, setNewProductName] = useState("");
  const [newProductCategory, setNewProductCategory] = useState("");
  const [newProductCost, setNewProductCost] = useState("");
  const [newProductSelling, setNewProductSelling] = useState("");
  const [newProductBarcode, setNewProductBarcode] = useState("");
  const [newProductQuantity, setNewProductQuantity] = useState("1");
  const [newProductPurchaseUnit, setNewProductPurchaseUnit] = useState("");
  const [newProductBaseUnit, setNewProductBaseUnit] = useState("");
  const [newProductConversion, setNewProductConversion] = useState("");
  const [bulkProductRows, setBulkProductRows] = useState([{name:"",category:"",cost:"",selling:"",barcode:"",quantity:"",purchaseUnit:"",baseUnit:"",conversion:""}]);
  const [productImportMessage, setProductImportMessage] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [transporters, setTransporters] = useState<Transporter[]>([]);
  const [purchaseSource, setPurchaseSource] = useState("Direct");
  const [deliveryMode, setDeliveryMode] = useState("Transporter");
  const [selectedTransporter, setSelectedTransporter] = useState("");
  const [freightAmount, setFreightAmount] = useState("0");
  const [freightPaid, setFreightPaid] = useState("0");
  const [freightMethod, setFreightMethod] = useState("Cash");
  const [newTransporterName, setNewTransporterName] = useState("");
  const [newTransporterPhone, setNewTransporterPhone] = useState("");
  const [transporterPayId, setTransporterPayId] = useState("");
  const [transporterPayAmount, setTransporterPayAmount] = useState("");
  const [dueCustomers, setDueCustomers] = useState<DueCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierAddress, setSupplierAddress] = useState("");
  const [supplierGst, setSupplierGst] = useState("");
  const [supplierOwner, setSupplierOwner] = useState("");
  const [supplierEmail, setSupplierEmail] = useState("");
  const [supplierAltPhone, setSupplierAltPhone] = useState("");
  const [supplierCity, setSupplierCity] = useState("");
  const [supplierState, setSupplierState] = useState("");
  const [supplierPostal, setSupplierPostal] = useState("");
  const [supplierCountry, setSupplierCountry] = useState("India");
  const [supplierNotes, setSupplierNotes] = useState("");
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [quantity, setQuantity] = useState("");
  const [purchaseUnit, setPurchaseUnit] = useState("");
  const [subUnitQuantity, setSubUnitQuantity] = useState("");
  const [subUnit, setSubUnit] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseLines, setPurchaseLines] = useState<PurchaseLine[]>([]);
  // Reuse the same request ID if a submission is retried after an uncertain network result.
  const [purchaseRequestId, setPurchaseRequestId] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [paidAmount, setPaidAmount] = useState("");
  const [purchaseMethod, setPurchaseMethod] = useState("Cash");
  const [supplierPayId, setSupplierPayId] = useState("");
  const [supplierPayAmount, setSupplierPayAmount] = useState("");
  const [customerPayId, setCustomerPayId] = useState("");
  const [customerPayAmount, setCustomerPayAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("Cash");

  const money = (value: number) => currency + Number(value || 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: auth } = await supabase.auth.getUser();
    const user = auth.user;
    if (!user) { setMessage("Please sign in as the shop owner to use Accounts."); setLoading(false); return; }
    const [supplierRes, purchaseRes, transporterRes] = await Promise.all([
      supabase.from("suppliers").select("*").eq("userId", user.id).order("name"),
      supabase.from("purchases").select("*").eq("userId", user.id).order("timestamp", { ascending: false }),
      supabase.from("transporters").select("id,name,phone").eq("userId", user.id).order("name"),
    ]);
    const err = supplierRes.error || purchaseRes.error || transporterRes.error;
    if (err) setMessage(err.message);
    setSuppliers((supplierRes.data || []) as Supplier[]);
    setPurchases((purchaseRes.data || []) as Purchase[]);
    setTransporters((transporterRes.data || []) as Transporter[]);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const supplierBalances = useMemo(() => {
    const map = new Map<string, { id: string; name: string; due: number }>();
    purchases.forEach(p => {
      if (!p.supplier_id) return;
      const row = map.get(p.supplier_id) || { id: p.supplier_id, name: p.supplier_name, due: 0 };
      row.due += Number(p.due_amount || 0);
      map.set(p.supplier_id, row);
    });
    return Array.from(map.values()).filter(x => x.due > 0).sort((a,b) => b.due-a.due);
  }, [purchases]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage("");
    try { await action(); await load(); await refreshData(); setMessage("Saved successfully."); }
    catch (e: any) { setMessage(e?.message || "The operation failed."); }
    finally { setBusy(false); }
  };

  const resetSupplierForm = () => {
    setEditingSupplier(null); setSupplierName(""); setSupplierPhone(""); setSupplierAddress("");
    setSupplierGst(""); setSupplierOwner(""); setSupplierEmail(""); setSupplierAltPhone("");
    setSupplierCity(""); setSupplierState(""); setSupplierPostal(""); setSupplierCountry("India"); setSupplierNotes("");
  };
  const editSupplier = (supplier: Supplier) => {
    setEditingSupplier(supplier.id); setSupplierName(supplier.name || ""); setSupplierPhone(supplier.phone || "");
    setSupplierAddress(supplier.address || ""); setSupplierGst(supplier.gst_number || "");
    setSupplierOwner(supplier.owner_name || ""); setSupplierEmail(supplier.email || "");
    setSupplierAltPhone(supplier.alternate_phone || ""); setSupplierCity(supplier.city || "");
    setSupplierState(supplier.state || ""); setSupplierPostal(supplier.postal_code || "");
    setSupplierCountry(supplier.country || "India"); setSupplierNotes(supplier.notes || "");
  };
  const addSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const args = { p_name: supplierName, p_phone: supplierPhone || null, p_address: supplierAddress || null,
        p_gst_number: supplierGst || null, p_owner_name: supplierOwner || null, p_email: supplierEmail || null,
        p_alternate_phone: supplierAltPhone || null, p_city: supplierCity || null, p_state: supplierState || null,
        p_postal_code: supplierPostal || null, p_country: supplierCountry || null, p_notes: supplierNotes || null };
      const result = editingSupplier
        ? await supabase.rpc("update_supplier", { p_supplier_id: editingSupplier, ...args })
        : await supabase.rpc("create_supplier", args);
      if (result.error) throw result.error;
      resetSupplierForm();
    });
  };

  type NewProductRow = {name:string;category:string;cost:string;selling:string;barcode:string;quantity:string;purchaseUnit:string;baseUnit:string;conversion:string};
  const addNewProductsToInvoice = async (rows: NewProductRow[]) => {
    // Product creation is deliberately deferred. These are draft invoice lines only;
    // the purchase RPC creates catalogue records and adds stock in one transaction.
    const prepared = rows.map(row => {
      const quantity=Number(row.quantity), factor=Number(row.conversion), unitCost=Number(row.cost), selling=Number(row.selling);
      if (!row.name.trim()) throw new Error("Every product row needs a product name.");
      if (!Number.isFinite(quantity)||quantity<=0||!Number.isFinite(factor)||factor<=0) throw new Error(`Enter a positive quantity and conversion factor for ${row.name}.`);
      if (!row.purchaseUnit.trim()||!row.baseUnit.trim()) throw new Error(`Enter both units for ${row.name}.`);
      if (!Number.isFinite(unitCost)||unitCost<0||!Number.isFinite(selling)||selling<=0) throw new Error(`Enter valid purchase cost and selling price for ${row.name}.`);
      return {row,quantity,factor,unitCost,selling};
    });
    setPurchaseLines(old=>[...old,...prepared.map(({row,quantity,factor,unitCost,selling})=>({
      productId:"draft:"+crypto.randomUUID(),
      name:row.name.trim(),
      quantity:quantity*factor,
      purchasePrice:unitCost/factor,
      purchaseQuantity:quantity,
      purchaseUnit:row.purchaseUnit.trim(),
      baseUnit:row.baseUnit.trim(),
      unitsPerPurchaseUnit:factor,
      purchaseUnitCost:unitCost,
      newProduct:{name:row.name.trim(),category:row.category.trim()||"Other",barcode:row.barcode.trim(),sellingPrice:selling,purchaseUnit:row.purchaseUnit.trim(),baseUnit:row.baseUnit.trim(),unitsPerPurchaseUnit:factor}
    }))]);
    setProductSource("existing");setSelectedProduct("");setShowProductCreator(false);setMessage("");
  };
  const saveQuickProduct = async () => {
    setBusy(true);setProductImportMessage("");
    try {
      await addNewProductsToInvoice([{name:newProductName,category:newProductCategory,cost:newProductCost,selling:newProductSelling,barcode:newProductBarcode,quantity:newProductQuantity,purchaseUnit:newProductPurchaseUnit,baseUnit:newProductBaseUnit,conversion:newProductConversion}]);
      setNewProductName("");setNewProductCost("");setNewProductSelling("");setNewProductBarcode("");setNewProductQuantity("");
    } catch(error:any){setProductImportMessage(error?.message||"Unable to create product.");}finally{setBusy(false);}
  };
  const saveBulkProducts = async () => {
    setBusy(true);setProductImportMessage("");
    try {const rows=bulkProductRows.filter(row=>row.name.trim());if(!rows.length)throw new Error("Add at least one product row.");await addNewProductsToInvoice(rows);}
    catch(error:any){setProductImportMessage(error?.message||"Bulk product creation failed.");}finally{setBusy(false);}
  };
  const parseCsv = (source:string) => {
    const rows:string[][]=[];let row:string[]=[];let value="";let quoted=false;
    for(let i=0;i<source.length;i++){const ch=source[i];if(ch==='"'&&source[i+1]==='"'&&quoted){value+='"';i++;}else if(ch==='"'){quoted=!quoted;}else if(ch===","&&!quoted){row.push(value);value="";}else if((ch==="\n"||ch==="\r")&&!quoted){if(ch==="\r"&&source[i+1]==="\n")i++;row.push(value);if(row.some(x=>x.trim()))rows.push(row);row=[];value="";}else value+=ch;}
    row.push(value);if(row.some(x=>x.trim()))rows.push(row);return rows;
  };
  const importProductsCsv = async (file: File) => {
    setBusy(true);setProductImportMessage("");
    try {
      const parsed=parseCsv(await file.text());const headers=(parsed.shift()||[]).map(x=>x.trim().toLowerCase());
      const col=(...names:string[])=>headers.findIndex(h=>names.includes(h));
      const name=col("product name","name"),category=col("category"),quantity=col("purchase quantity","quantity"),purchaseUnit=col("purchase unit","purchase_unit"),baseUnit=col("stock unit","base unit","base_unit"),conversion=col("units per purchase unit","conversion factor","units_per_purchase_unit"),cost=col("purchase cost per purchase unit","purchase cost","purchaseprice","purchase_price"),selling=col("selling price","sellingprice","selling_price","mrp"),barcode=col("barcode","sku");
      if([name,quantity,purchaseUnit,baseUnit,conversion,cost,selling].some(i=>i<0))throw new Error("CSV must include all columns from the downloadable template.");
      const rows:NewProductRow[]=parsed.filter(r=>r[name]?.trim()).map(r=>({name:r[name],category:category>=0?r[category]:"",quantity:r[quantity],purchaseUnit:r[purchaseUnit],baseUnit:r[baseUnit],conversion:r[conversion],cost:r[cost],selling:r[selling],barcode:barcode>=0?r[barcode]:""}));
      if(!rows.length)throw new Error("No product rows found in the CSV.");
      await addNewProductsToInvoice(rows);
    }catch(error:any){setProductImportMessage(error?.message||"CSV import failed.");}finally{setBusy(false);}
  };
  const csvTemplate="Product Name,Category,Purchase Quantity,Purchase Unit,Stock Unit,Units per Purchase Unit,Purchase Cost per Purchase Unit,Selling Price,Barcode\nSample Product,Grocery,3,Box,Piece,12,240,25,SKU-001\n";
  const downloadCsvTemplate=()=>{const blob=new Blob([csvTemplate],{type:"text/csv;charset=utf-8;"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="retail-sync-purchase-template.csv";link.click();URL.revokeObjectURL(url);};
  const addLineToPurchase = () => {
    const product = products.find(p => p.id === selectedProduct);
    const qty = Number(quantity); const cost = Number(purchasePrice || 0); const factor = Number(subUnitQuantity);
    if (productSource !== "existing" || !product || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(factor) || factor <= 0 || !Number.isFinite(cost) || cost < 0 || !purchaseUnit || !subUnit) {
      setMessage("Select a product and enter a valid quantity, unit conversion and purchase rate."); return;
    }
    const unitCost = cost / factor;
    // A changed purchase cost gets its own catalogue identity. The original
    // product remains untouched; the new identity is only created by the
    // final purchase RPC, together with its stock intake.
    const createCostVariant =
      Math.abs(unitCost - Number(product.purchasePrice || 0)) > 0.000001 ||
      (product.purchase_unit || "Piece") !== purchaseUnit ||
      (product.base_unit || "Piece") !== subUnit ||
      Number(product.units_per_purchase_unit || 1) !== factor;
    const lineId = createCostVariant ? "draft:" + crypto.randomUUID() : product.id;
    const newProduct = createCostVariant ? {
      name: product.name,
      category: product.category || "Other",
      barcode: "",
      sellingPrice: Number(product.sellingPrice),
      purchaseUnit,
      baseUnit: subUnit,
      unitsPerPurchaseUnit: factor
    } : undefined;
    setPurchaseLines(old => {
      const existing = old.find(line => line.productId === lineId);
      const line = {
        productId: lineId,
        name: product.name,
        quantity: qty * factor,
        purchasePrice: unitCost,
        purchaseQuantity: qty,
        purchaseUnit,
        baseUnit: subUnit,
        unitsPerPurchaseUnit: factor,
        purchaseUnitCost: cost,
        ...(newProduct ? { newProduct } : {})
      };
      return existing
        ? old.map(item => item.productId === lineId
            ? { ...item, quantity: item.quantity + line.quantity,
                purchaseQuantity: (item.purchaseQuantity || 0) + qty,
                purchaseUnit, baseUnit: subUnit, unitsPerPurchaseUnit: factor,
                purchaseUnitCost: cost, purchasePrice: unitCost }
            : item)
        : [...old, line];
    });
    setSelectedProduct(""); setQuantity(""); setSubUnitQuantity(""); setPurchasePrice("");
    setPurchaseUnit(""); setSubUnit(""); setProductSource("existing"); setMessage("");
  };

  const removePurchaseLine = (productId: string) => setPurchaseLines(old => old.filter(line => line.productId !== productId));

  const addPurchase = (e: React.FormEvent) => {
    e.preventDefault();
    const goodsTotal = purchaseLines.reduce((sum,line)=>sum+line.quantity*line.purchasePrice,0);
    const paid = Number(paidAmount || 0);
    const freight = Number(freightAmount || 0); const freightPaidNow = Number(freightPaid || 0);
    if (purchaseLines.length === 0 || paid < 0 || paid > goodsTotal || (paid < goodsTotal && !selectedSupplier) || freight < 0 || freightPaidNow < 0 || freightPaidNow > freight || (freight > 0 && !selectedTransporter)) {
      setMessage("Add at least one product and check supplier, freight and payment amounts. Select a supplier when goods remain unpaid."); return;
    }
    const requestId = purchaseRequestId || crypto.randomUUID();
    setPurchaseRequestId(requestId);
    void run(async () => {
      const supplier = suppliers.find(s => s.id === selectedSupplier);
      const { error } = await supabase.rpc("create_purchase_with_logistics", { p_purchase: {
        request_id: requestId,
        supplier_id: selectedSupplier || null, supplier_name: supplier?.name || "Unspecified supplier",
        invoice_number: invoiceNumber || null, items: purchaseLines.map(line => ({productId:line.newProduct ? null : line.productId, ...(line.newProduct ? {newProduct:line.newProduct} : {}),quantity:line.quantity,purchasePrice:line.purchasePrice,purchaseQuantity:line.purchaseQuantity ?? line.quantity,purchaseUnit:line.purchaseUnit ?? "Piece",baseUnit:line.baseUnit ?? "Piece",unitsPerPurchaseUnit:line.unitsPerPurchaseUnit ?? 1,purchaseUnitCost:line.purchaseUnitCost ?? line.purchasePrice})),
        paid_amount: paid, payment_method: purchaseMethod, notes: null,
        purchase_source: purchaseSource, delivery_mode: deliveryMode,
        transporter_id: selectedTransporter || null, freight_amount: freight,
        freight_paid_amount: freightPaidNow, freight_payment_method: freightMethod
      }});
      if (error) throw error;
      setPurchaseLines([]); setQuantity("1"); setPurchasePrice(""); setInvoiceNumber(""); setPaidAmount("");
      setFreightAmount("0"); setFreightPaid("0"); setSelectedTransporter(""); setPurchaseRequestId("");
    });
  };

  const addTransporter = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { error } = await supabase.rpc("create_transporter", { p_name: newTransporterName, p_phone: newTransporterPhone || null, p_notes: null });
      if (error) throw error;
      setNewTransporterName(""); setNewTransporterPhone("");
    });
  };

  const payTransporter = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { error } = await supabase.rpc("record_transporter_payment", { p_transporter_id: transporterPayId, p_amount: Number(transporterPayAmount), p_method: paymentMethod, p_notes: null });
      if (error) throw error;
      setTransporterPayAmount("");
    });
  };

  const paySupplier = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { error } = await supabase.rpc("record_supplier_payment", { p_supplier_id: supplierPayId, p_amount: Number(supplierPayAmount), p_method: paymentMethod, p_notes: null });
      if (error) throw error;
      setSupplierPayAmount("");
    });
  };

  const collectCustomer = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      const { error } = await supabase.rpc("record_customer_payment", { p_customer_id: customerPayId, p_amount: Number(customerPayAmount), p_method: paymentMethod, p_notes: null });
      if (error) throw error;
      setCustomerPayAmount("");
    });
  };

  const transporterBalances = useMemo(() => transporters.map(t => ({
    ...t, due: purchases.filter(p => p.transporter_id === t.id).reduce((sum,p) => sum + Number(p.freight_due_amount || 0),0)
  })).filter(t => t.due > 0).sort((a,b) => b.due-a.due), [transporters,purchases]);
  const totalFreightDue = transporterBalances.reduce((sum,t)=>sum+t.due,0);
  const totalPayable = supplierBalances.reduce((s,x)=>s+x.due,0);
  const totalReceivable = dueCustomers.reduce((s,x)=>s+x.due,0);

  return <div className="flex-1 overflow-y-auto bg-[#FAF8F5] p-5 md:p-8 text-black space-y-6">
    <header className="border-b-4 border-black pb-5 flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-black uppercase">Purchases</h1><p className="text-xs font-mono font-bold text-zinc-600 mt-1">Supplier invoices and stock intake</p></div>
      <button className={buttonClass} onClick={() => void load()} disabled={loading}>Refresh</button>
    </header>
    {message && <div className="p-3 border-2 border-black bg-amber-100 text-sm font-bold">{message}</div>}
    <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <div className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000]"><p className="text-[10px] font-black uppercase text-zinc-500">Supplier outstanding</p><p className="text-2xl font-black mt-2">{money(totalPayable)}</p></div>
      <div className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000]"><p className="text-[10px] font-black uppercase text-zinc-500">Customer outstanding</p><p className="text-2xl font-black mt-2">{money(totalReceivable)}</p></div>
      <div className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000]"><p className="text-[10px] font-black uppercase text-zinc-500">Recorded purchases</p><p className="text-2xl font-black mt-2">{money(purchases.reduce((s,p)=>s+Number(p.total_amount||0),0))}</p></div>
      <div className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000]"><p className="text-[10px] font-black uppercase text-zinc-500">Transporter outstanding</p><p className="text-2xl font-black mt-2">{money(totalFreightDue)}</p></div>
    </section>
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <form onSubmit={addPurchase} className="bg-white border-3 border-black p-5 shadow-[4px_4px_0_#000] space-y-3">
        <h2 className="font-black uppercase text-lg border-b-2 border-black pb-2">Record stock purchase</h2>
        <label className="block text-xs font-black uppercase">Purchase source</label>
        <select className={inputClass} value={purchaseSource} onChange={e=>setPurchaseSource(e.target.value)}><option value="Direct">Direct purchase</option><option value="Agent-assisted">Through agent</option></select>
        <label className="block text-xs font-black uppercase">Supplier</label>
        <select className={inputClass} value={selectedSupplier} onChange={e=>setSelectedSupplier(e.target.value)}><option value="">Choose supplier (optional)</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
                <label className="block text-xs font-black uppercase">Product source</label>
        <div className="grid grid-cols-2 gap-2"><button type="button" onClick={()=>{setProductSource("existing");setSelectedProduct("");setPurchasePrice("");}} className={"p-3 border-2 border-black text-xs font-black uppercase "+(productSource==="existing"?"bg-[#FFC300]":"bg-white")}>Select existing product</button><button type="button" onClick={()=>{setProductSource("new");setShowProductCreator(true);}} className={"p-3 border-2 border-black text-xs font-black uppercase "+(productSource==="new"?"bg-[#FFC300]":"bg-white")}>Add new product</button></div>
        {productSource==="existing" && <select required className={inputClass} value={selectedProduct} onChange={e=>{setSelectedProduct(e.target.value);const p=products.find(x=>x.id===e.target.value);setPurchasePrice("");setPurchaseUnit("");setSubUnit(p?.base_unit||"");setSubUnitQuantity("");}}><option value="">Choose from existing catalogue</option>{products.map(p=><option key={p.id} value={p.id}>{p.name} — {p.purchase_unit||"Piece"} ({p.base_unit||"Piece"} stock), Current stock: {p.quantity}</option>)}</select>}
        {productSource==="new" && <p className="text-xs font-bold bg-zinc-100 p-2">New products remain draft invoice items until you save the purchase. No catalogue or stock changes happen yet.</p>}
        {showProductCreator && <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-3"><div className="bg-[#FAF8F5] border-4 border-black shadow-[6px_6px_0_#000] w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4">
          <div className="flex justify-between items-center"><h3 className="text-lg font-black uppercase">Add products to catalogue</h3><button type="button" onClick={()=>setShowProductCreator(false)} className="border-2 border-black bg-white px-3 py-1 font-black">✕</button></div>
          <div className="grid grid-cols-3 gap-2"><button type="button" onClick={()=>setNewProductMode("quick")} className={"border-2 border-black p-2 text-xs font-black uppercase "+(newProductMode==="quick"?"bg-[#FFC300]":"bg-white")}>Quick Add</button><button type="button" onClick={()=>setNewProductMode("bulk")} className={"border-2 border-black p-2 text-xs font-black uppercase "+(newProductMode==="bulk"?"bg-[#FFC300]":"bg-white")}>Bulk Add</button><button type="button" onClick={()=>setNewProductMode("csv")} className={"border-2 border-black p-2 text-xs font-black uppercase "+(newProductMode==="csv"?"bg-[#FFC300]":"bg-white")}>Import CSV</button></div>
          {newProductMode==="quick" && <div className="grid grid-cols-1 md:grid-cols-2 gap-3"><input required className={inputClass} value={newProductName} onChange={e=>setNewProductName(e.target.value)} placeholder="Product name"/><input className={inputClass} value={newProductCategory} onChange={e=>setNewProductCategory(e.target.value)} placeholder="Category (optional)"/><div className="grid grid-cols-2 gap-2"><input required type="number" min="0.0001" step="any" className={inputClass} value={newProductQuantity} onChange={e=>setNewProductQuantity(e.target.value)} placeholder="Quantity"/><select required className={inputClass} value={newProductPurchaseUnit} onChange={e=>setNewProductPurchaseUnit(e.target.value)}><option value="">Units</option>{["Box","Carton","Packet","Pack","Bag","Kg","Gram","Quintal","Tonne","Litre","Millilitre","Meter","Centimeter","Millimeter","Feet","Inch","Piece","Dozen","Pair","Roll","Bundle","Bottle","Can","Tin","Sheet","Set","Pallet"].map(u=><option key={u}>{u}</option>)}</select><input required type="number" min="0.0001" step="any" className={inputClass} value={newProductConversion} onChange={e=>setNewProductConversion(e.target.value)} placeholder="Sub-unit quantity"/><select required className={inputClass} value={newProductBaseUnit} onChange={e=>setNewProductBaseUnit(e.target.value)}><option value="">Sub units</option>{["Box","Carton","Packet","Pack","Bag","Kg","Gram","Quintal","Tonne","Litre","Millilitre","Meter","Centimeter","Millimeter","Feet","Inch","Piece","Dozen","Pair","Roll","Bundle","Bottle","Can","Tin","Sheet","Set","Pallet"].map(u=><option key={u}>{u}</option>)}</select></div><input required type="number" min="0" step="0.01" className={inputClass} value={newProductCost} onChange={e=>setNewProductCost(e.target.value)} placeholder="Purchase cost per box"/><input required type="number" min="0.01" step="0.01" className={inputClass} value={newProductSelling} onChange={e=>setNewProductSelling(e.target.value)} placeholder="Selling price per stock unit"/><input className={inputClass} value={newProductBarcode} onChange={e=>setNewProductBarcode(e.target.value)} placeholder="Barcode / SKU (optional)"/><p className="md:col-span-2 text-xs font-bold bg-zinc-100 p-2">Invoice quantity: {Number(newProductQuantity||0)*Number(newProductConversion||0)} {newProductBaseUnit}. Unit cost: {Number(newProductConversion)>0?(Number(newProductCost||0)/Number(newProductConversion)).toFixed(2):"—"} per {newProductBaseUnit}.</p><button type="button" disabled={busy||!newProductPurchaseUnit||!newProductBaseUnit||Number(newProductConversion)<=0} onClick={()=>void saveQuickProduct()} className={buttonClass}>Add product to purchase</button></div>}
          {newProductMode==="bulk" && <div className="space-y-3"><p className="text-xs font-bold">Each row adds its purchased quantity to this invoice. Purchase cost is per purchase unit; selling price is per stock unit.</p>{bulkProductRows.map((row,i)=><div key={i} className="grid grid-cols-2 md:grid-cols-5 gap-2 border-b-2 border-zinc-200 pb-3"><input required className={inputClass} placeholder="Product name" value={row.name} onChange={e=>setBulkProductRows(old=>old.map((x,j)=>j===i?{...x,name:e.target.value}:x))}/><input className={inputClass} placeholder="Category" value={row.category} onChange={e=>setBulkProductRows(old=>old.map((x,j)=>j===i?{...x,category:e.target.value}:x))}/><input required type="number" min="1" step="1" className={inputClass} placeholder="Purchased qty" value={row.quantity} onChange={e=>setBulkProductRows(old=>old.map((x,j)=>j===i?{...x,quantity:e.target.value}:x))}/><select required className={inputClass} value={row.purchaseUnit} onChange={e=>setBulkProductRows(old=>old.map((x,j)=>j===i?{...x,purchaseUnit:e.target.value}:x))}><option value="">Units</option>{["Box","Carton","Packet","Pack","Bag","Kg","Gram","Quintal","Tonne","Litre","Millilitre","Meter","Centimeter","Millimeter","Feet","Inch","Piece","Dozen","Pair","Roll","Bundle","Bottle","Can","Tin","Sheet","Set","Pallet"].map(u=><option key={u}>{u}</option>)}</select><input required type="number" min="0.0001" step="any" className={inputClass} placeholder="Sub-unit quantity" value={row.conversion} onChange={e=>setBulkProductRows(old=>old.map((x,j)=>j===i?{...x,conversion:e.target.value}:x))}/><select required className={inputClass} value={row.baseUnit} onChange={e=>setBulkProductRows(old=>old.map((x,j)=>j===i?{...x,baseUnit:e.target.value}:x))}><option value="">Sub units</option>{["Box","Carton","Packet","Pack","Bag","Kg","Gram","Quintal","Tonne","Litre","Millilitre","Meter","Centimeter","Millimeter","Feet","Inch","Piece","Dozen","Pair","Roll","Bundle","Bottle","Can","Tin","Sheet","Set","Pallet"].map(u=><option key={u}>{u}</option>)}</select><input required type="number" min="0" step="0.01" className={inputClass} placeholder="Cost per purchase unit" value={row.cost} onChange={e=>setBulkProductRows(old=>old.map((x,j)=>j===i?{...x,cost:e.target.value}:x))}/><input required type="number" min="0.01" step="0.01" className={inputClass} placeholder="Selling price per stock unit" value={row.selling} onChange={e=>setBulkProductRows(old=>old.map((x,j)=>j===i?{...x,selling:e.target.value}:x))}/><input className={inputClass} placeholder="Barcode / SKU" value={row.barcode} onChange={e=>setBulkProductRows(old=>old.map((x,j)=>j===i?{...x,barcode:e.target.value}:x))}/><p className="col-span-2 md:col-span-5 text-xs font-bold">Invoice stock quantity: {Number(row.quantity||0)*Number(row.conversion||0)} {row.baseUnit}</p></div>)}<div className="flex gap-2"><button type="button" onClick={()=>setBulkProductRows(old=>[...old,{name:"",category:"",cost:"",selling:"",barcode:"",quantity:"1",purchaseUnit:"Box",baseUnit:"Piece",conversion:"1"}])} className="border-2 border-black bg-white px-3 py-2 text-xs font-black">Add row</button><button type="button" disabled={busy} onClick={()=>void saveBulkProducts()} className={buttonClass}>Add products to purchase</button></div></div>}
          {newProductMode==="csv" && <div className="space-y-3"><p className="text-xs font-bold">Download the template and fill one row per product. Imported quantities become lines in this purchase invoice. Use a purchase unit such as Box and a stock unit such as Piece.</p><button type="button" onClick={downloadCsvTemplate} className="border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase">Download CSV template</button><input type="file" accept=".csv,text/csv" className={inputClass} onChange={e=>{const file=e.target.files?.[0];if(file)void importProductsCsv(file);}}/></div>}
          {productImportMessage && <p className="p-3 border-2 border-black bg-amber-100 text-xs font-bold">{productImportMessage}</p>}
        </div></div>}
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-black uppercase mb-1">Purchase quantity</label><input className={inputClass} type="number" min="0.0001" step="any" required value={quantity} onChange={e=>setQuantity(e.target.value)}/></div><div><label className="block text-xs font-black uppercase mb-1">Units</label><select className={inputClass} value={purchaseUnit} onChange={e=>setPurchaseUnit(e.target.value)}><option value="">Choose unit</option>{["Box","Carton","Packet","Pack","Bag","Kg","Gram","Quintal","Tonne","Litre","Millilitre","Meter","Centimeter","Millimeter","Feet","Inch","Piece","Dozen","Pair","Roll","Bundle","Bottle","Can","Tin","Sheet","Set","Pallet"].map(u=><option key={u}>{u}</option>)}</select></div><div><label className="block text-xs font-black uppercase mb-1">Sub-unit quantity per unit</label><input className={inputClass} type="number" min="0.0001" step="any" required value={subUnitQuantity} onChange={e=>setSubUnitQuantity(e.target.value)}/></div><div><label className="block text-xs font-black uppercase mb-1">Sub units</label><select className={inputClass} value={subUnit} disabled={productSource==="existing" && !!selectedProduct} onChange={e=>setSubUnit(e.target.value)}><option value="">Choose sub-unit</option>{["Box","Carton","Packet","Pack","Bag","Kg","Gram","Quintal","Tonne","Litre","Millilitre","Meter","Centimeter","Millimeter","Feet","Inch","Piece","Dozen","Pair","Roll","Bundle","Bottle","Can","Tin","Sheet","Set","Pallet"].map(u=><option key={u}>{u}</option>)}</select></div><div className="col-span-2"><label className="block text-xs font-black uppercase mb-1">Cost per purchase unit</label><input className={inputClass} type="number" min="0" step="0.01" required value={purchasePrice} onChange={e=>setPurchasePrice(e.target.value)}/></div></div>
        <button type="button" className="border-2 border-black bg-white px-3 py-2 text-xs font-black uppercase" onClick={addLineToPurchase}>Add product to invoice</button>
        <div className="border-2 border-black p-3 space-y-2">
          <h3 className="text-xs font-black uppercase">Invoice items ({purchaseLines.length})</h3>
          {purchaseLines.length===0 ? <p className="text-xs text-zinc-500">No products added yet.</p> : purchaseLines.map(line=><div key={line.productId} className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 pb-2 text-xs"><span className="font-bold">{line.name}{line.newProduct ? " · New catalogue entry" : ""} · {line.purchaseQuantity ?? line.quantity} {line.purchaseUnit ?? "units"} ({line.quantity} {line.baseUnit ?? "stock units"}) × {money(line.purchaseUnitCost ?? line.purchasePrice)}</span><span className="font-black">{money(line.quantity*line.purchasePrice)} <button type="button" onClick={()=>removePurchaseLine(line.productId)} className="ml-2 underline text-red-700">Remove</button></span></div>)}
          <div className="text-right font-black text-sm">Goods total: {money(purchaseLines.reduce((sum,line)=>sum+line.quantity*line.purchasePrice,0))}</div>
        </div>
        <div><label className="block text-xs font-black uppercase mb-1">Supplier invoice number</label><input className={inputClass} value={invoiceNumber} onChange={e=>setInvoiceNumber(e.target.value)} placeholder="Optional"/></div>
        <div className="border-2 border-black p-3 space-y-3">
          <h3 className="font-black uppercase text-sm">Delivery & freight (separate from goods bill)</h3>
          <label className="block text-xs font-black uppercase">Delivery mode</label>
          <select className={inputClass} value={deliveryMode} onChange={e=>setDeliveryMode(e.target.value)}><option>Self Pickup</option><option>Supplier Delivery</option><option>Transporter</option><option>Courier</option><option>Other</option></select>
          <label className="block text-xs font-black uppercase">Transporter</label>
          <select className={inputClass} value={selectedTransporter} onChange={e=>setSelectedTransporter(e.target.value)}><option value="">Select transporter (if freight is charged)</option>{transporters.map(t=><option key={t.id} value={t.id}>{t.name}{t.phone ? " · "+t.phone : ""}</option>)}</select>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-black uppercase mb-1">Separate freight cost</label><input className={inputClass} type="number" min="0" step="0.01" value={freightAmount} onChange={e=>setFreightAmount(e.target.value)}/></div>
            <div><label className="block text-xs font-black uppercase mb-1">Freight paid now</label><input className={inputClass} type="number" min="0" step="0.01" value={freightPaid} onChange={e=>setFreightPaid(e.target.value)}/></div>
          </div>
          <label className="block text-xs font-black uppercase">Freight payment method</label>
          <select className={inputClass} value={freightMethod} onChange={e=>setFreightMethod(e.target.value)}><option>Cash</option><option>UPI</option><option>Bank</option><option>Card</option><option>Cheque</option></select>
          <p className="text-xs font-bold">Freight outstanding: {money(Math.max(0,Number(freightAmount||0)-Number(freightPaid||0)))}</p>
        </div>
        <div className="grid grid-cols-2 gap-3"><div><label className="block text-xs font-black uppercase mb-1">Paid now</label><input className={inputClass} type="number" min="0" step="0.01" value={paidAmount} onChange={e=>setPaidAmount(e.target.value)} placeholder="0.00"/></div><div><label className="block text-xs font-black uppercase mb-1">Payment method</label><select className={inputClass} value={purchaseMethod} onChange={e=>setPurchaseMethod(e.target.value)}><option>Cash</option><option>UPI</option><option>Bank</option><option>Card</option><option>Cheque</option></select></div></div>
        <p className="text-xs font-bold bg-zinc-100 p-2">Goods total: {money(purchaseLines.reduce((sum,line)=>sum+line.quantity*line.purchasePrice,0))} · Supplier due: {money(Math.max(0,purchaseLines.reduce((sum,line)=>sum+line.quantity*line.purchasePrice,0)-Number(paidAmount||0)))} · Freight: {money(Number(freightAmount||0))}</p>
        <button className={buttonClass} disabled={busy || loading}>Save purchase & add stock</button>
      </form>
    </section>
    <section className="grid grid-cols-1 xl:grid-cols-2 gap-6">
      <form onSubmit={addTransporter} className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000] space-y-3">
        <h2 className="font-black uppercase text-lg">Transporters</h2>
        <input required className={inputClass} placeholder="Transporter / company name" value={newTransporterName} onChange={e=>setNewTransporterName(e.target.value)}/>
        <input className={inputClass} placeholder="Phone (optional)" value={newTransporterPhone} onChange={e=>setNewTransporterPhone(e.target.value)}/>
        <button className={buttonClass} disabled={busy}>Add transporter</button>
        <div className="border-t-2 border-black pt-3"><h3 className="font-black uppercase text-sm mb-2">Outstanding freight</h3>
          {transporterBalances.length===0 ? <p className="text-xs text-zinc-500">No transporter dues.</p> : transporterBalances.map(t=><div key={t.id} className="flex justify-between text-sm border-b py-2"><span className="font-bold">{t.name}</span><strong>{money(t.due)}</strong></div>)}
        </div>
      </form>
      <form onSubmit={payTransporter} className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000] space-y-3">
        <h2 className="font-black uppercase text-lg">Pay transporter</h2>
        <select required className={inputClass} value={transporterPayId} onChange={e=>setTransporterPayId(e.target.value)}><option value="">Select transporter</option>{transporterBalances.map(t=><option key={t.id} value={t.id}>{t.name} — Due {money(t.due)}</option>)}</select>
        <input required type="number" min="0.01" step="0.01" className={inputClass} placeholder="Payment amount" value={transporterPayAmount} onChange={e=>setTransporterPayAmount(e.target.value)}/>
        <select className={inputClass} value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}><option>Cash</option><option>UPI</option><option>Bank</option><option>Card</option><option>Cheque</option></select>
        <button className={buttonClass} disabled={busy || !transporterPayId}>Record transporter payment</button>
      </form>
    </section>
    <section className="bg-white border-3 border-black p-5 shadow-[3px_3px_0_#000]">
      <h2 className="font-black uppercase text-lg mb-3">Purchase history</h2>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b-2 border-black text-xs uppercase"><th className="p-2">Date / Invoice</th><th className="p-2">Supplier</th><th className="p-2 text-right">Total</th><th className="p-2 text-right">Paid</th><th className="p-2 text-right">Due</th></tr></thead><tbody>{purchases.map(p=><tr key={p.id} className="border-b border-zinc-200"><td className="p-2">{new Date(p.timestamp).toLocaleDateString("en-IN")}<small className="block text-zinc-500">{p.invoice_number || p.id}</small></td><td className="p-2">{p.supplier_name}</td><td className="p-2 text-right">{money(Number(p.total_amount))}</td><td className="p-2 text-right">{money(Number(p.paid_amount))}</td><td className="p-2 text-right font-black">{money(Number(p.due_amount))}</td></tr>)}</tbody></table></div>
    </section>
  </div>;
}
