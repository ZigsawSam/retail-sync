import React, { useState, useMemo, useEffect } from "react";
import { getShopLocalISOString } from "../lib/dateUtils";
const getDateInputToday = () => { const d = new Date(); return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); };
const timestampForSelectedDate = (date: string) => date+"T12:00:00-07:00";


import { 
  Plus, 
  Trash2, 
  Barcode, 
  Search, 
  PlusCircle, 
  Sparkles, 
  Clipboard, 
  Download, 
  Check, 
  User, 
  Percent, 
  Phone,
  MessageSquare,
  FileText,
  ShoppingCart,
  Printer,
  ArrowLeft,
  Copy
} from "lucide-react";
import { Product, Customer, Sale, SaleItem } from "../types";
import { jsPDF } from "jspdf";
import { motion, AnimatePresence } from "motion/react";

interface SalesPageProps {
  products: Product[];
  customers: Customer[];
  sales: Sale[];
  shopName: string;
  taxRate: number;
  currency: string;
  onAddSale: (sale: Sale) => Promise<void>;
  onAddProduct: (product: Product) => void;
  onAddCustomer: (customer: Customer) => void;
  showInvoiceForm?: boolean;
  setShowInvoiceForm?: (val: boolean) => void;
  quickAddProductIds?: string[];
}

export default function SalesPage({
  products,
  customers,
  sales,
  shopName,
  taxRate: defaultTaxRate,
  currency,
  onAddSale,
  onAddProduct,
  onAddCustomer,
  showInvoiceForm: controlledShowInvoiceForm,
  setShowInvoiceForm: controlledSetShowInvoiceForm,
  quickAddProductIds
}: SalesPageProps) {
  // Page states
  const [localShowInvoiceForm, localSetShowInvoiceForm] = useState(false);
  const showInvoiceForm = controlledShowInvoiceForm !== undefined ? controlledShowInvoiceForm : localShowInvoiceForm;
  const setShowInvoiceForm = controlledSetShowInvoiceForm !== undefined ? controlledSetShowInvoiceForm : localSetShowInvoiceForm;
  const [searchSalesQuery, setSearchSalesQuery] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(getDateInputToday);
  const [checkoutFocusMode, setCheckoutFocusMode] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setCheckoutFocusMode(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [searchProductQuery, setSearchProductQuery] = useState("");
  
  // Selected Cart items
  const [cart, setCart] = useState<{ product: Product; quantity: number; commissionPercent: number; price: number }[]>([]);
  
  // Commission Agent Details
  const [agentName, setAgentName] = useState("");
  const [agentPhone, setAgentPhone] = useState("");
  
  // Settings/Controls
  const [isTaxEnabled, setIsTaxEnabled] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState("Cash");
  const [initialPaymentReceived, setInitialPaymentReceived] = useState("");
  const [redeemPoints, setRedeemPoints] = useState(false);
  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [customDiscount, setCustomDiscount] = useState<number>(0);

  // Modal control states
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [finalizedSale, setFinalizedSale] = useState<Sale | null>(null);
  
  // Print preview states
  const [previewSale, setPreviewSale] = useState<Sale | null>(null);
  const [showPrintPreviewModal, setShowPrintPreviewModal] = useState(false);
  const [selectedInvoiceStyle, setSelectedInvoiceStyle] = useState<'classic' | 'thermal' | 'modern' | 'minimalist'>('classic');
  
  // Flow control states after finalizing
  const [showCommissionPrompt, setShowCommissionPrompt] = useState(false);
  const [showSmsSimulator, setShowSmsSimulator] = useState(false);
  const [showInvoiceDownloadOptions, setShowInvoiceDownloadOptions] = useState(false);
  const [simulatedSmsText, setSimulatedSmsText] = useState("");
  const [smsSentDetails, setSmsSentDetails] = useState<any>(null);

  // Barcode scanner simulator state
  const [scannedCode, setScannedCode] = useState("");
  const [scanStatus, setScanStatus] = useState<"idle" | "success" | "error">("idle");

  // Instant add product form states
  const [newProdName, setNewProdName] = useState("");
  const [newProdCategory, setNewProdCategory] = useState("Apparel");
  const [newProdPurchasePrice, setNewProdPurchasePrice] = useState("");
  const [newProdSellingPrice, setNewProdSellingPrice] = useState("");
  const [newProdQuantity, setNewProdQuantity] = useState("");
  const [newProdBarcode, setNewProdBarcode] = useState("");

  // 1. Monthly sales total as of now (For July 2026)
  const currentMonthSalesTotal = useMemo(() => {
    return sales
      .filter(s => s.timestamp.includes("2026-07"))
      .reduce((acc, s) => acc + s.totalAmount, 0);
  }, [sales]);

  const filteredSales = useMemo(() => {
    if (!searchSalesQuery) return sales;
    const query = searchSalesQuery.toLowerCase();
    return sales.filter(s => 
      s.id.toLowerCase().includes(query) ||
      s.customerName.toLowerCase().includes(query) ||
      s.customerPhone.toLowerCase().includes(query) ||
      s.paymentMethod.toLowerCase().includes(query)
    );
  }, [sales, searchSalesQuery]);

  // Handle barcode scanning simulation
  const handleBarcodeScan = (codeToScan?: string) => {
    const code = codeToScan || scannedCode;
    if (!code) return;

    const foundProd = products.find(p => p.barcode === code);
    if (foundProd) {
      if (foundProd.quantity <= 0) {
        setScanStatus("error");
        setTimeout(() => setScanStatus("idle"), 2000);
        return;
      }
      // Add to cart
      const existingCartItemIdx = cart.findIndex(item => item.product.id === foundProd.id);
      if (existingCartItemIdx > -1) {
        const updated = [...cart];
        updated[existingCartItemIdx].quantity += 1;
        setCart(updated);
      } else {
        setCart([...cart, { product: foundProd, quantity: 1, commissionPercent: 0, price: foundProd.sellingPrice }]);
      }
      setScanStatus("success");
      setScannedCode("");
      setTimeout(() => setScanStatus("idle"), 1500);
    } else {
      setScanStatus("error");
      setTimeout(() => setScanStatus("idle"), 2000);
    }
  };

  // Instant Add Customer lookup when phone OR name is entered
  const matchedCustomer = useMemo(() => {
    const trimmedPhone = customerPhone.trim();
    const trimmedName = customerName.trim().toLowerCase();
    
    if (trimmedPhone.length >= 10) {
      return customers.find(c => c.phone.trim() === trimmedPhone) || null;
    }
    if (trimmedName.length >= 2) {
      return customers.find(c => c.name.toLowerCase() === trimmedName) || null;
    }
    return null;
  }, [customerPhone, customerName, customers]);

  // Auto-fill customer details when a matching phone number is typed
  useEffect(() => {
    const trimmedPhone = customerPhone.trim();
    if (trimmedPhone.length >= 10) {
      const found = customers.find(c => c.phone.trim() === trimmedPhone);
      if (found) {
        if (customerName !== found.name) {
          setCustomerName(found.name);
        }
        if (found.email && customerEmail !== found.email) {
          setCustomerEmail(found.email);
        }
      }
    }
  }, [customerPhone, customers, customerName, customerEmail]);

  // Auto-fill phone number when a matching customer name is typed
  useEffect(() => {
    const trimmedName = customerName.trim().toLowerCase();
    if (trimmedName.length >= 2) {
      const found = customers.find(c => c.name.toLowerCase() === trimmedName);
      if (found) {
        if (customerPhone !== found.phone) {
          setCustomerPhone(found.phone);
        }
        if (found.email && customerEmail !== found.email) {
          setCustomerEmail(found.email);
        }
      }
    }
  }, [customerName, customers, customerPhone, customerEmail]);

  // Points conversion (e.g. 10 points = $1 discount)
  const POINTS_CONVERSION_RATE = 10; 
  const availablePointsDiscount = useMemo(() => {
    if (!matchedCustomer) return 0;
    return Math.floor(matchedCustomer.points / POINTS_CONVERSION_RATE);
  }, [matchedCustomer]);

  // Filtered products for search dropdown
  const filteredProducts = useMemo(() => {
    if (!searchProductQuery) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(searchProductQuery.toLowerCase()) ||
      p.barcode.includes(searchProductQuery)
    );
  }, [searchProductQuery, products]);

  // Subtotal, Tax, and Totals
  const subtotal = useMemo(() => {
    return cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
  }, [cart]);

  const discountAmount = useMemo(() => {
    if (redeemPoints && matchedCustomer) {
      // redeem up to available points or subtotal
      const maxDiscount = Math.min(availablePointsDiscount, subtotal);
      return maxDiscount;
    }
    return 0;
  }, [redeemPoints, matchedCustomer, availablePointsDiscount, subtotal]);

  const taxAmount = useMemo(() => {
    if (!isTaxEnabled) return 0;
    const rate = defaultTaxRate / 100;
    return Math.max(0, (subtotal - discountAmount - customDiscount) * rate);
  }, [isTaxEnabled, subtotal, discountAmount, customDiscount, defaultTaxRate]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discountAmount - customDiscount + taxAmount);
  }, [subtotal, discountAmount, customDiscount, taxAmount]);

  // Total commission generated
  const totalCommission = useMemo(() => {
    return cart.reduce((acc, item) => {
      const itemSubtotal = item.price * item.quantity;
      return acc + (itemSubtotal * (item.commissionPercent / 100));
    }, 0);
  }, [cart]);

  // Add item to cart
  const addToCart = (product: Product) => {
    if (product.quantity <= 0) return;
    const idx = cart.findIndex(item => item.product.id === product.id);
    if (idx > -1) {
      const updated = [...cart];
      if (updated[idx].quantity < product.quantity) {
        updated[idx].quantity += 1;
        setCart(updated);
      }
    } else {
      setCart([...cart, { product, quantity: 1, commissionPercent: 0, price: product.sellingPrice }]);
    }
    setSearchProductQuery("");
  };

  // Update item quantity
  const updateCartQuantity = (productId: string, qty: number) => {
    const item = cart.find(c => c.product.id === productId);
    if (!item) return;
    const maxQty = item.product.quantity;
    const clampedQty = Math.max(1, Math.min(qty, maxQty));
    
    setCart(cart.map(c => c.product.id === productId ? { ...c, quantity: clampedQty } : c));
  };

  // Update item price
  const updateCartItemPrice = (productId: string, newPrice: number) => {
    setCart(cart.map(c => c.product.id === productId ? { ...c, price: Math.max(0, newPrice) } : c));
  };

  // Update commission percent for specific item
  const updateItemCommissionPercent = (productId: string, pct: number) => {
    setCart(cart.map(c => c.product.id === productId ? { ...c, commissionPercent: pct } : c));
  };

  // Remove from cart
  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  // Quick-Add items dynamic per shop owner based on Custom Selection settings
  const quickAddItems = useMemo(() => {
    if (quickAddProductIds && quickAddProductIds.length > 0) {
      const filtered = products.filter(p => quickAddProductIds.includes(p.id));
      if (filtered.length > 0) return filtered;
    }
    return products.slice(0, 3);
  }, [products, quickAddProductIds]);

  // Submit new product instantly
  const handleInstantProductAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName || !newProdSellingPrice || !newProdPurchasePrice || !newProdQuantity) return;

    const newProd: Product = {
      id: "prod-" + Date.now(),
      name: newProdName,
      category: newProdCategory,
      purchasePrice: parseFloat(newProdPurchasePrice),
      sellingPrice: parseFloat(newProdSellingPrice),
      quantity: parseInt(newProdQuantity),
      barcode: newProdBarcode || ("SKU-" + Math.floor(100000 + Math.random() * 900000)),
      lowStockLimit: 5,
      overstockLimit: 30
    };

    onAddProduct(newProd);
    // Automatically add to cart immediately!
    setCart([...cart, { product: newProd, quantity: 1, commissionPercent: 0, price: newProd.sellingPrice }]);
    
    // Reset form
    setNewProdName("");
    setNewProdPurchasePrice("");
    setNewProdSellingPrice("");
    setNewProdQuantity("");
    setNewProdBarcode("");
    setShowAddProductModal(false);
  };

  // Finalize Sale process
  const handleFinalize = async () => {
    if (cart.length === 0) return;
    if (paymentMethod === "Store Credit" && !matchedCustomer) { alert("Select an existing saved customer before recording a credit sale."); return; }

    // Check if new customer and we should onboard them to loyalty points
    let finalCustName = customerName || "General Customer";
    let finalCustPhone = customerPhone || "N/A";
    
    if (customerPhone && !matchedCustomer) {
      // Auto-onboard customer
      const newCust: Customer = {
        id: "cust-" + Date.now(),
        name: finalCustName,
        phone: finalCustPhone,
        email: customerEmail || "",
        points: Math.floor(totalAmount / 10), // 1 point for every $10
        tier: "Bronze",
        totalSpent: totalAmount
      };
      onAddCustomer(newCust);
    } else if (matchedCustomer) {
      // update existing points & loyalty
      const pointsEarned = Math.floor(totalAmount / 10);
      const redeemedPointsDed = redeemPoints ? (discountAmount * POINTS_CONVERSION_RATE) : 0;
      matchedCustomer.points = Math.max(0, matchedCustomer.points - redeemedPointsDed + pointsEarned);
      matchedCustomer.totalSpent += totalAmount;
      if (matchedCustomer.totalSpent >= 10000) matchedCustomer.tier = "Gold";
      else if (matchedCustomer.totalSpent >= 3000) matchedCustomer.tier = "Silver";
    }

    const saleItems: SaleItem[] = cart.map(item => ({
      productId: item.product.id,
      name: item.product.name,
      quantity: item.quantity,
      price: item.price,
      commissionPercent: item.commissionPercent
    }));

    const saleRecord: Sale = {
      id: "TX-" + (1000 + sales.length + 1),
      customerName: finalCustName,
      customerPhone: finalCustPhone,
      customerId: matchedCustomer?.id || null,
      paidAmount: paymentMethod === "Store Credit" ? Math.min(totalAmount, Math.max(0, Number(initialPaymentReceived || 0))) : totalAmount,
      dueAmount: paymentMethod === "Store Credit" ? Math.max(0, totalAmount - Math.min(totalAmount, Math.max(0, Number(initialPaymentReceived || 0)))) : 0,
      items: saleItems,
      subtotal,
      taxRate: isTaxEnabled ? defaultTaxRate : 0,
      taxAmount,
      totalAmount,
      paymentMethod,
      timestamp: timestampForSelectedDate(invoiceDate),
      clearanceStatus: "Pending",
      discountAmount: discountAmount + customDiscount,
      commissionAgent: agentName ? {
        name: agentName,
        phone: agentPhone || "N/A",
        commissionPercent: cart.length > 0 ? Math.round(cart.reduce((s, c) => s + c.commissionPercent, 0) / cart.length) : 0,
        commissionAmount: totalCommission,
        notified: false
      } : undefined
    };

    setFinalizedSale(saleRecord);

    if (agentName && totalCommission > 0) {
      setShowCommissionPrompt(true);
    } else {
      // Direct to receipt options
      try { await onAddSale(saleRecord); setShowInvoiceDownloadOptions(true); } catch (error: any) { alert(error?.message || "Sale could not be saved. No stock was deducted."); }
    }
  };

  const handleCommissionConfirmation = async (generate: boolean) => {
    setShowCommissionPrompt(false);
    if (!finalizedSale) return;

    // Save the sale and its commission immediately, regardless of whether SMS is requested.
    // This prevents a failed notification or a closed dialog from losing the sale.
    try {
      await onAddSale(finalizedSale);
    } catch (error: any) {
      alert(error?.message || "Sale could not be saved. No stock was deducted.");
      return;
    }

    if (generate && finalizedSale.commissionAgent) {
      try {
        const response = await fetch("/api/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            agentName: finalizedSale.commissionAgent.name,
            agentPhone: finalizedSale.commissionAgent.phone,
            amount: finalizedSale.commissionAgent.commissionAmount.toFixed(2),
            shopName
          })
        });
        const data = await response.json();
        if (data.success) {
          setSmsSentDetails(data.sms);
          setSimulatedSmsText(data.sms.message);
          setShowSmsSimulator(true);
        } else {
          setSimulatedSmsText(`Commission of ${currency}${finalizedSale.commissionAgent.commissionAmount.toFixed(2)} has been recorded for ${finalizedSale.commissionAgent.name}. SMS notification was not sent.`);
          setShowSmsSimulator(true);
        }
      } catch (err) {
        console.error("Commission SMS notification failed:", err);
        setSimulatedSmsText(`Commission of ${currency}${finalizedSale.commissionAgent.commissionAmount.toFixed(2)} has been recorded for ${finalizedSale.commissionAgent.name}. SMS notification was not sent.`);
        setShowSmsSimulator(true);
      }
    } else {
      setShowInvoiceDownloadOptions(true);
    }
  };

  const closeSmsSimulator = async () => {
    setShowSmsSimulator(false);
    setShowInvoiceDownloadOptions(true);
  };

  // 1. Download Invoice PDF with jsPDF (strictly hiding agent and commission details)
  const generatePdfInvoice = (
    saleRecord?: Sale,
    style: 'classic' | 'thermal' | 'modern' | 'minimalist' = 'classic'
  ) => {
    const sale = saleRecord || finalizedSale;
    if (!sale) return;
    
    const curr = currency;

    if (style === 'thermal') {
      // 80mm thermal receipt width. Custom dimensions: 80mm x 180mm.
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [80, 180]
      });

      doc.setFont("courier", "bold");
      doc.setFontSize(11);
      doc.setTextColor(0, 0, 0);
      
      const centerText = (textStr: string, yPos: number) => {
        const textWidth = doc.getTextWidth(textStr);
        const xPos = (80 - textWidth) / 2;
        doc.text(textStr, xPos, yPos);
      };

      centerText(shopName.toUpperCase(), 12);
      
      doc.setFont("courier", "normal");
      doc.setFontSize(8);
      centerText("OFFICIAL RETAIL RECEIPT", 17);
      centerText("================================", 21);
      
      doc.text(`INV: ${sale.id.slice(0, 16)}`, 5, 27);
      doc.text(`DATE: ${new Date(sale.timestamp).toLocaleDateString()}`, 5, 32);
      doc.text(`TIME: ${new Date(sale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`, 5, 37);
      doc.text(`CUST: ${sale.customerName.toUpperCase()}`, 5, 42);
      doc.text(`PMT:  ${sale.paymentMethod.toUpperCase()}`, 5, 47);
      
      doc.text("--------------------------------", 5, 52);
      
      doc.setFont("courier", "bold");
      doc.text("ITEM", 5, 57);
      doc.text("QTY", 42, 57);
      doc.text("PRICE", 52, 57);
      doc.text("TOTAL", 68, 57);
      doc.text("--------------------------------", 5, 61);
      
      doc.setFont("courier", "normal");
      let y = 66;
      sale.items.forEach((item) => {
        let name = item.name.toUpperCase();
        if (name.length > 18) {
          name = name.slice(0, 16) + "..";
        }
        doc.text(name, 5, y);
        doc.text(item.quantity.toString(), 42, y);
        doc.text(item.price.toFixed(1), 52, y);
        doc.text((item.price * item.quantity).toFixed(1), 68, y);
        y += 5;
      });
      
      doc.text("--------------------------------", 5, y);
      y += 5;
      
      doc.text("SUBTOTAL:", 30, y);
      doc.text(curr + sale.subtotal.toFixed(2), 55, y);
      y += 5;
      
      if (sale.taxAmount > 0) {
        doc.text(`TAX (${sale.taxRate}%):`, 30, y);
        doc.text(curr + sale.taxAmount.toFixed(2), 55, y);
        y += 5;
      }
      
      doc.setFont("courier", "bold");
      doc.setFontSize(9);
      doc.text("TOTAL DUE:", 30, y);
      doc.text(curr + sale.totalAmount.toFixed(2), 55, y);
      y += 8;
      
      doc.setFont("courier", "normal");
      doc.setFontSize(7);
      centerText("THANK YOU FOR YOUR VISIT!", y);
      centerText("HAVE A WONDERFUL DAY", y + 4);
      
      doc.save(`receipt_${sale.id}.pdf`);
      return;
    }

    if (style === 'modern') {
      const doc = new jsPDF();
      
      // Top elegant accent bar (Teal banner)
      doc.setFillColor(13, 148, 136); // Teal 600
      doc.rect(0, 0, 210, 15, "F");
      
      // Header Shop branding
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text(shopName, 20, 32);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(13, 148, 136); // Teal 600
      doc.text("ELEGANT INVOICE RECEIPT", 20, 39);
      
      // Invoice Details Block (right side)
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("DATE: " + new Date(sale.timestamp).toLocaleDateString(), 140, 32);
      doc.text("INVOICE ID: " + sale.id.slice(0, 18), 140, 38);
      
      // Rounded Card Background for Bill To details
      doc.setFillColor(240, 253, 250); // Teal 50 (light teal background)
      doc.setDrawColor(204, 251, 241); // Teal 100 border
      doc.setLineWidth(0.5);
      doc.rect(20, 48, 170, 22, "FD"); // Filled & Bordered
      
      // Customer Details inside Teal card
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(13, 148, 136);
      doc.text("PREPARED FOR:", 25, 54);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text("Customer: " + sale.customerName, 25, 60);
      doc.text("Phone: " + sale.customerPhone, 25, 65);
      
      doc.setFont("helvetica", "bold");
      doc.text("PAYMENT:", 120, 54);
      doc.setFont("helvetica", "normal");
      doc.text("Method: " + sale.paymentMethod, 120, 60);
      
      // Items table header
      doc.setFillColor(13, 148, 136); // Teal 600
      doc.rect(20, 78, 170, 9, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255); // White headers
      doc.text("PRODUCT NAME", 24, 845 / 10); // around y = 84
      doc.text("QTY", 110, 84);
      doc.text("UNIT PRICE", 135, 84);
      doc.text("TOTAL", 170, 84);
      
      // Items content
      let y = 94;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(51, 65, 85); // slate-700
      
      sale.items.forEach((item, index) => {
        // Draw subtle alternating zebra stripes
        if (index % 2 === 1) {
          doc.setFillColor(248, 250, 252); // slate-50
          doc.rect(20, y - 5, 170, 7, "F");
        }
        
        doc.text(item.name, 24, y);
        doc.text(item.quantity.toString(), 112, y);
        doc.text(curr + item.price.toFixed(2), 135, y);
        doc.text(curr + (item.price * item.quantity).toFixed(2), 170, y);
        y += 8;
      });
      
      // Totals Section
      doc.setDrawColor(224, 242, 254);
      doc.line(20, y + 2, 190, y + 2);
      y += 10;
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      
      doc.text("Subtotal:", 135, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(curr + sale.subtotal.toFixed(2), 170, y);
      
      y += 6;
      if (sale.discountAmount && sale.discountAmount > 0) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(214, 48, 49);
        doc.text("Discount:", 135, y);
        doc.setFont("helvetica", "bold");
        doc.text("-" + curr + sale.discountAmount.toFixed(2), 170, y);
        y += 6;
      }
      
      if (sale.taxAmount > 0) {
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`Tax (${sale.taxRate}%):`, 135, y);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 23, 42);
        doc.text(curr + sale.taxAmount.toFixed(2), 170, y);
        y += 6;
      }
      
      // Highlighted Grand Total Box
      doc.setFillColor(240, 253, 250);
      doc.rect(130, y - 4, 60, 8, "F");
      
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      doc.text("Grand Total:", 135, y + 1);
      doc.setTextColor(13, 148, 136); // Teal 600
      doc.text(curr + sale.totalAmount.toFixed(2), 170, y + 1);
      
      // Elegant Footer Note
      doc.setFont("helvetica", "italic");
      doc.setFontSize(9);
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text("Thank you for your valuable patronage! Generated with pride via Retail Sync.", 20, 275);
      
      doc.save(`invoice_elegant_${sale.id}.pdf`);
      return;
    }

    if (style === 'minimalist') {
      const doc = new jsPDF();
      
      // Plain Black & White. Clean serif or sans-serif look.
      doc.setFont("helvetica", "bold");
      doc.setFontSize(24);
      doc.setTextColor(0, 0, 0);
      doc.text(shopName.toUpperCase(), 20, 32);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("INVOICE RECORD", 20, 39);
      
      // Invoice metadata (right)
      doc.text(`ID: ${sale.id}`, 130, 32);
      doc.text(`DATE: ${new Date(sale.timestamp).toLocaleDateString()}`, 130, 37);
      
      // Very thin lines
      doc.setLineWidth(0.15);
      doc.setDrawColor(0, 0, 0);
      doc.line(20, 44, 190, 44);
      
      // Customer Details
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`CLIENT: ${sale.customerName.toUpperCase()}`, 20, 52);
      doc.text(`PHONE: ${sale.customerPhone}`, 20, 57);
      doc.text(`METHOD: ${sale.paymentMethod.toUpperCase()}`, 130, 52);
      
      doc.line(20, 64, 190, 64);
      
      // Table Header
      doc.setFont("helvetica", "bold");
      doc.text("DESCRIPTION", 22, 70);
      doc.text("QTY", 110, 70);
      doc.text("UNIT", 135, 70);
      doc.text("TOTAL", 170, 70);
      
      doc.line(20, 74, 190, 74);
      
      // Table content
      let y = 82;
      doc.setFont("helvetica", "normal");
      sale.items.forEach((item) => {
        doc.text(item.name.toUpperCase(), 22, y);
        doc.text(item.quantity.toString(), 110, y);
        doc.text(curr + item.price.toFixed(2), 135, y);
        doc.text(curr + (item.price * item.quantity).toFixed(2), 170, y);
        y += 8;
      });
      
      doc.line(20, y - 2, 190, y - 2);
      y += 8;
      
      // Totals
      doc.text("SUBTOTAL", 110, y);
      doc.text(curr + sale.subtotal.toFixed(2), 170, y);
      y += 6;
      
      if (sale.taxAmount > 0) {
        doc.text(`TAX (${sale.taxRate}%)`, 110, y);
        doc.text(curr + sale.taxAmount.toFixed(2), 170, y);
        y += 6;
      }
      
      doc.setFont("helvetica", "bold");
      doc.text("GRAND TOTAL", 110, y);
      doc.text(curr + sale.totalAmount.toFixed(2), 170, y);
      
      // Fine-art style footer
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.text("WWW.RETAILSYNC.IO  /  THANK YOU", 20, 275);
      
      doc.save(`invoice_minimal_${sale.id}.pdf`);
      return;
    }

    // Default 'classic' template
    const doc = new jsPDF();
    
    // Header Shop branding
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.setTextColor(30, 41, 59); // slate-800
    doc.text(shopName, 20, 25);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text("Official Invoice Receipt", 20, 31);
    doc.text("Date: " + new Date(sale.timestamp).toLocaleDateString(), 140, 25);
    doc.text("Invoice ID: " + sale.id, 140, 31);
    
    // Draw a slate line
    doc.setDrawColor(203, 213, 225); // slate-300
    doc.setLineWidth(0.5);
    doc.line(20, 38, 190, 38);

    // Customer details
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(71, 85, 105); // slate-600
    doc.text("BILL TO:", 20, 48);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text("Customer: " + sale.customerName, 20, 55);
    doc.text("Phone: " + sale.customerPhone, 20, 61);
    doc.text("Payment Method: " + sale.paymentMethod, 140, 55);

    // Items table header
    doc.setFillColor(241, 245, 249); // slate-100
    doc.rect(20, 72, 170, 8, "F");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text("PRODUCT NAME", 24, 77);
    doc.text("QTY", 110, 77);
    doc.text("UNIT PRICE", 135, 77);
    doc.text("TOTAL", 170, 77);

    // Items content (no commission details generated!)
    let y = 86;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(51, 65, 85); // slate-700
    
    sale.items.forEach((item) => {
      doc.text(item.name, 24, y);
      doc.text(item.quantity.toString(), 112, y);
      doc.text(curr + item.price.toFixed(2), 135, y);
      doc.text(curr + (item.price * item.quantity).toFixed(2), 170, y);
      y += 8;
    });

    // Totals Section
    doc.line(20, y + 2, 190, y + 2);
    y += 10;
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    
    doc.text("Subtotal:", 135, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(15, 23, 42);
    doc.text(curr + sale.subtotal.toFixed(2), 170, y);
    
    y += 6;
    if (sale.discountAmount && sale.discountAmount > 0) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(214, 48, 49);
      doc.text("Discount:", 135, y);
      doc.setFont("helvetica", "bold");
      doc.text("-" + curr + sale.discountAmount.toFixed(2), 170, y);
      y += 6;
    }
    
    if (sale.taxAmount > 0) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`Tax (${sale.taxRate}%):`, 135, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 23, 42);
      doc.text(curr + sale.taxAmount.toFixed(2), 170, y);
      y += 6;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Grand Total:", 135, y);
    doc.setTextColor(37, 99, 235); // blue-600
    doc.text(curr + sale.totalAmount.toFixed(2), 170, y);

    // Footer
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184); // slate-400
    doc.text("Thank you for your business! Automatically processed via Retail Sync.", 20, 275);

    // Save
    doc.save(`invoice_${sale.id}.pdf`);
  };

  // 2. Copy Bill to Clipboard (strictly hiding agent and commission details)
  const copyBillToClipboard = (saleRecord?: Sale) => {
    const sale = saleRecord || finalizedSale;
    if (!sale) return;
    const curr = currency;

    let text = `========================================\n`;
    text += `             ${shopName.toUpperCase()}             \n`;
    text += `========================================\n`;
    text += `Invoice ID : ${sale.id}\n`;
    text += `Date       : ${new Date(sale.timestamp).toLocaleString()}\n`;
    text += `Customer   : ${sale.customerName}\n`;
    text += `Phone      : ${sale.customerPhone}\n`;
    text += `----------------------------------------\n`;
    text += `ITEMS\n`;
    text += `----------------------------------------\n`;
    
    sale.items.forEach(item => {
      const itemTotal = curr + (item.price * item.quantity).toFixed(2);
      text += `${item.name.padEnd(22)} x${item.quantity.toString().padEnd(3)} ${itemTotal.padStart(12)}\n`;
    });
    
    text += `----------------------------------------\n`;
    text += `Subtotal:`.padEnd(28) + (curr + sale.subtotal.toFixed(2)).padStart(12) + `\n`;
    if (sale.discountAmount && sale.discountAmount > 0) {
      text += `Discount:`.padEnd(28) + (`-${curr}` + sale.discountAmount.toFixed(2)).padStart(12) + `\n`;
    }
    if (sale.taxAmount > 0) {
      text += `Tax (${sale.taxRate}%):`.padEnd(28) + (curr + sale.taxAmount.toFixed(2)).padStart(12) + `\n`;
    }
    text += `GRAND TOTAL:`.padEnd(28) + (curr + sale.totalAmount.toFixed(2)).padStart(12) + `\n`;
    text += `Payment Method: ${sale.paymentMethod}\n`;
    text += `========================================\n`;
    text += `   Thank you! Please visit us again.   \n`;
    text += `========================================\n`;

    navigator.clipboard.writeText(text);
    alert("Bill details copied to clipboard! (Agent commissions are hidden for customer privacy)");
  };

  const handleFinishSession = () => {
    // Reset page states
    setCart([]);
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setAgentName("");
    setAgentPhone("");
    setRedeemPoints(false);
    setPointsToRedeem(0);
    setCustomDiscount(0);
    setInitialPaymentReceived("");
    setFinalizedSale(null);
    setShowInvoiceDownloadOptions(false);
    setShowInvoiceForm(false);
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#FAF8F5] p-8 text-black select-none">
      
      {!showInvoiceForm ? (
        // SALES TRANSACTION LEDGER DASHBOARD
        <div className="space-y-6 animate-fadeIn">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b-3 border-black pb-5">
            <div>
              <h2 className="text-3xl font-black uppercase text-black">Sales Ledger & Invoices</h2>
              <p className="text-xs text-zinc-600 font-bold font-mono mt-1">Track real-time inventory transactions and customer orders</p>
            </div>
            
            <button 
              onClick={() => {
                setShowInvoiceForm(true);
                // Clear any state
                setCart([]);
                setCustomerName("");
                setCustomerPhone("");
                setCustomerEmail("");
                setAgentName("");
                setAgentPhone("");
                setRedeemPoints(false);
                setPointsToRedeem(0);
                setCustomDiscount(0);
              }}
              className="flex items-center gap-2 px-5 py-3 bg-[#0055A5] hover:bg-[#004488] text-white rounded-none border-2 border-black text-sm font-black transition-all shadow-[3px_3px_0px_0px_#000] cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>GENERATE INVOICE</span>
            </button>
          </div>

          {/* Quick Metrics Header */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white border-3 border-black rounded-none p-5 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div>
                <span className="text-[10px] uppercase font-mono font-black text-zinc-600">Monthly Revenue</span>
                <h4 className="text-2xl font-black text-black font-mono mt-1">
                  {currency}{currentMonthSalesTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                </h4>
                <p className="text-[9px] text-zinc-600 font-bold font-mono mt-1">JULY 2026 OPERATIONS</p>
              </div>
              <div className="p-2.5 bg-[#F5F2EB] border-2 border-black rounded-none text-black">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border-3 border-black rounded-none p-5 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div>
                <span className="text-[10px] uppercase font-mono font-black text-zinc-600">Total Invoices</span>
                <h4 className="text-2xl font-black text-black font-mono mt-1">
                  {sales.filter(s => s.timestamp.includes("2026-07")).length} Bills
                </h4>
                <p className="text-[9px] text-zinc-600 font-bold font-mono mt-1">STABLE CLIENT METRICS</p>
              </div>
              <div className="p-2.5 bg-[#F5F2EB] border-2 border-black rounded-none text-black">
                <ShoppingCart className="w-5 h-5" />
              </div>
            </div>

            <div className="bg-white border-3 border-black rounded-none p-5 flex items-center justify-between shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
              <div>
                <span className="text-[10px] uppercase font-mono font-black text-zinc-600">Agent Commissions</span>
                <h4 className="text-2xl font-black text-[#D63031] font-mono mt-1">
                  {currency}{sales.reduce((sum, s) => {
                    const agentAmt = s.items.reduce((itemSum, item) => {
                      if (!s.commissionAgent) return 0;
                      return itemSum + (item.price * item.quantity * (item.commissionPercent / 100));
                    }, 0);
                    return sum + agentAmt;
                  }, 0).toFixed(2)}
                </h4>
                <p className="text-[9px] text-zinc-600 font-bold font-mono mt-1">AUTOMATED SMS PAYMENTS</p>
              </div>
              <div className="p-2.5 bg-[#F5F2EB] border-2 border-black rounded-none text-[#D63031]">
                <Percent className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search bar and ledger list */}
          <div className="bg-white border-3 border-black rounded-none p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
              <div>
                <h3 className="text-xl font-black uppercase text-black">Transactions History</h3>
                <p className="text-[11px] text-zinc-600 font-bold font-mono">Download receipts, check commissions, and customer summaries</p>
              </div>
              <div className="relative w-full md:w-80">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-black" />
                <input 
                  type="text" 
                  placeholder="Search invoice, customer, payment method..."
                  value={searchSalesQuery}
                  onChange={(e) => setSearchSalesQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-white border-2 border-black rounded-none text-xs text-black font-mono font-bold placeholder-zinc-500 focus:outline-none"
                />
              </div>
            </div>

            {/* List block */}
            {filteredSales.length === 0 ? (
              <div className="text-center py-12 border-2 border-dashed border-black bg-[#F5F2EB] rounded-none">
                <FileText className="w-10 h-10 text-black mx-auto mb-3" />
                <p className="text-sm font-black text-black">No matching sales transactions found</p>
                <p className="text-xs text-zinc-600 font-mono mt-1 font-bold">Complete a sale in 'Generate Invoice' to log active receipts</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead>
                    <tr className="border-b-2 border-black text-black font-black text-[10px] uppercase tracking-wider bg-[#F5F2EB]">
                      <th className="py-3 px-4 border-r border-black">Invoice ID</th>
                      <th className="py-3 px-4 border-r border-black">Timestamp</th>
                      <th className="py-3 px-4 border-r border-black">Customer Info</th>
                      <th className="py-3 px-4 border-r border-black">Method</th>
                      <th className="py-3 px-4 border-r border-black">Commission Agent</th>
                      <th className="py-3 px-4 border-r border-black text-right">Total Amount</th>
                      <th className="py-3 px-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSales.map((sale) => {
                      // Calculate commissions
                      const hasAgent = !!sale.commissionAgent;
                      const agentComm = sale.items.reduce((sum, item) => {
                        if (!hasAgent) return 0;
                        return sum + (item.price * item.quantity * (item.commissionPercent / 100));
                      }, 0);

                      return (
                        <tr key={sale.id} className="border-b border-black hover:bg-[#F5F2EB]/40 transition-colors group text-black">
                          <td className="py-3 px-4 text-black font-black border-r border-black">{sale.id}</td>
                          <td className="py-3 px-4 text-zinc-600 text-[10px] font-bold border-r border-black">
                            {new Date(sale.timestamp).toLocaleString("en-US", {
                              month: "short",
                              day: "numeric",
                              hour: "numeric",
                              minute: "2-digit"
                            })}
                          </td>
                          <td className="py-3 px-4 border-r border-black">
                            <div className="flex flex-col">
                              <span className="text-black font-black font-sans">{sale.customerName}</span>
                              <span className="text-[10px] text-zinc-600 font-bold">{sale.customerPhone}</span>
                            </div>
                          </td>
                          <td className="py-3 px-4 border-r border-black">
                            <span className={`px-2 py-0.5 rounded-none text-[9px] font-black uppercase border border-black ${
                              sale.paymentMethod === "Cash" ? "bg-[#FFC300] text-black" :
                              sale.paymentMethod === "UPI" ? "bg-[#0055A5] text-white" :
                              "bg-white text-black"
                            }`}>
                              {sale.paymentMethod}
                            </span>
                          </td>
                          <td className="py-3 px-4 border-r border-black">
                            {hasAgent ? (
                              <div className="flex flex-col text-[10px]">
                                <span className="text-[#D63031] font-sans font-black">{sale.commissionAgent?.name}</span>
                                <span className="text-zinc-600 text-[9px] font-bold font-mono">Comm: {currency}{agentComm.toFixed(2)}</span>
                              </div>
                            ) : (
                              <span className="text-zinc-400 font-sans">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right text-black font-black font-sans border-r border-black">
                            {currency}{sale.totalAmount.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <button 
                                onClick={() => {
                                  setPreviewSale(sale);
                                  setSelectedInvoiceStyle('classic');
                                  setShowPrintPreviewModal(true);
                                }}
                                title="Download PDF Receipt"
                                className="p-1.5 bg-white hover:bg-black hover:text-white text-black rounded-none transition-all border-2 border-black cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                              </button>
                              <button 
                                onClick={() => copyBillToClipboard(sale)}
                                title="Copy Invoice Details"
                                className="p-1.5 bg-white hover:bg-black hover:text-white text-black rounded-none transition-all border-2 border-black cursor-pointer"
                              >
                                <Clipboard className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : (
        // RENDER THE ORIGINAL BILLING AND INVOICING FORM
        <div className={checkoutFocusMode ? "fixed inset-0 z-50 bg-[#FAF9F6] p-6 md:p-10 overflow-y-auto flex flex-col space-y-6" : "space-y-6"}>
          
          {checkoutFocusMode && (
            <div className="bg-black text-white p-4 rounded-none border-2 border-black flex flex-col sm:flex-row justify-between items-center gap-3 animate-fadeIn">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-xs font-black font-mono uppercase tracking-wider">🎯 FOCUS CHECKOUT MODE ACTIVE</span>
                <span className="text-[10px] text-zinc-300 hidden md:inline">• Sidebars are hidden to maximize checkout speed and accuracy.</span>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutFocusMode(false)}
                className="px-4 py-1.5 bg-white text-black hover:bg-[#FFC300] text-[10px] font-black uppercase tracking-wider font-mono border border-black cursor-pointer transition-all shadow-[2px_2px_0px_0px_#000]"
              >
                Exit Focus Mode (Esc)
              </button>
            </div>
          )}

          {!checkoutFocusMode ? (
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b-3 border-black pb-4 gap-2">
              <button 
                onClick={() => setShowInvoiceForm(false)}
                className="flex items-center gap-1.5 text-xs font-mono font-bold text-black hover:bg-zinc-100 bg-white px-3.5 py-2 border-2 border-black rounded-none transition-all cursor-pointer animate-fadeIn"
              >
                ← BACK TO SALES LEDGER
              </button>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setCheckoutFocusMode(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-750 text-white text-[11px] font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_0px_#000] cursor-pointer transition-all"
                >
                  🎯 ENTER FOCUS CHECKOUT MODE
                </button>
                <div className="text-right">
                  <h2 className="text-xl font-black uppercase text-black">Generate Invoice</h2>
                  <p className="text-[10px] text-zinc-600 font-bold font-mono">Operations Period: July 2026</p>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col lg:flex-row gap-8 animate-fadeIn">
            
            {/* LEFT: Billing, Customer details, item selection */}
            <div className="flex-1 space-y-6">
        
        {/* Monthly Sales Tracker Indicator */}
        <div className="bg-[#FFC300] text-black rounded-none p-6 border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden flex items-center justify-between">
          <div className="z-10">
            <h3 className="text-black text-xs font-black uppercase tracking-wider font-mono">Monthly Retail Sales</h3>
            <p className="text-3xl font-black tracking-tight mt-1 text-black">{currency}{currentMonthSalesTotal.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
            <p className="text-[10px] text-zinc-800 mt-1 font-mono uppercase font-bold">Operations Period: July 2026</p>
          </div>
          <div className="z-10 p-3 bg-white border-2 border-black rounded-none text-black">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <div className="absolute right-0 top-0 w-64 h-64 bg-white/20 rounded-none -translate-y-12 translate-x-12 rotate-12 border-l-2 border-black" />
        </div>

        {/* Invoice transaction date */}
        <div className="bg-white p-4 rounded-none border-3 border-black shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]">
          <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Invoice Date</label>
          <input type="date" required value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} className="w-full md:w-64 px-3 py-2.5 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none" />
          <p className="text-[10px] text-zinc-500 font-mono mt-1">Select the actual transaction date. The invoice and sales ledger will use this date.</p>
        </div>

        {/* Customer & Loyalty details */}
        <div className="bg-white p-6 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <div className="flex items-center justify-between mb-4 border-b-2 border-black pb-3">
            <h3 className="font-black uppercase text-black flex items-center gap-2 text-base">
              <User className="w-4 h-4 text-black" />
              <span>Customer Loyalty Connection</span>
            </h3>
            {matchedCustomer && (
              <span className={`px-2.5 py-0.5 rounded-none text-[10px] font-black font-mono uppercase tracking-wider border-2 border-black ${
                matchedCustomer.tier === "Gold" ? "bg-[#FFC300] text-black" :
                matchedCustomer.tier === "Silver" ? "bg-white text-black" :
                "bg-[#D63031] text-white"
              }`}>
                {matchedCustomer.tier} Member
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Phone Number (Lookup)</label>
              <div className="relative">
                <Phone className="absolute left-3 top-3.5 w-4 h-4 text-black" />
                <input 
                  type="text" 
                  placeholder="e.g., 9876543210"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-black text-black placeholder-zinc-500 rounded-none text-sm font-bold focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Customer Name</label>
              <input 
                type="text" 
                placeholder="Walking Customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border-2 border-black text-black placeholder-zinc-500 rounded-none text-sm font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Email Address (Optional)</label>
              <input 
                type="email" 
                placeholder="customer@email.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border-2 border-black text-black placeholder-zinc-500 rounded-none text-sm font-bold focus:outline-none"
              />
            </div>
          </div>

          {/* Add Customer Profile warning message */}
          {(customerName || customerPhone) && !matchedCustomer && (
            <div className="mt-4 p-3.5 bg-[#FCE8E6] border-2 border-black rounded-none text-black text-xs animate-fadeIn flex flex-col md:flex-row md:items-center justify-between gap-3 font-mono">
              <div>
                <p className="font-black text-[#D63031]">⚠️ Customer profile not found</p>
                <p className="text-[10px] text-zinc-600 mt-0.5 font-mono font-bold">Add customer to register and unlock loyalty rewards</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  const newCust: Customer = {
                    id: "cust-" + Date.now(),
                    name: customerName || "Walking Customer",
                    phone: customerPhone || ("9" + Math.floor(100000000 + Math.random() * 900000000)),
                    email: customerEmail || "",
                    points: 0,
                    tier: "Bronze",
                    totalSpent: 0
                  };
                  onAddCustomer(newCust);
                }}
                className="px-3.5 py-1.5 bg-[#D63031] hover:bg-[#E54849] text-white border-2 border-black rounded-none text-[10px] font-black uppercase tracking-wider transition-all shadow-[2px_2px_0px_0px_#000] shrink-0 cursor-pointer"
              >
                Add new customer
              </button>
            </div>
          )}

          {/* Loyalty details popup if customer is found */}
          {matchedCustomer && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 p-3.5 bg-[#E8F0FE] border-2 border-black rounded-none flex items-center justify-between text-black"
            >
              <div>
                <p className="text-[10px] text-blue-900 font-black uppercase tracking-wider font-mono">Loyalty Wallet Balance</p>
                <p className="text-xs text-zinc-700 mt-1 font-bold">Available Points: <strong className="text-blue-900 font-mono font-black">{matchedCustomer.points} pts</strong> (Convertible to <strong>{currency}{availablePointsDiscount}</strong> cash discount)</p>
              </div>
              <button 
                onClick={() => setRedeemPoints(!redeemPoints)}
                className={`px-4 py-1.5 border-2 border-black rounded-none text-xs font-black transition-all cursor-pointer ${
                  redeemPoints 
                    ? "bg-[#0055A5] text-white" 
                    : "bg-white hover:bg-zinc-100 text-black"
                }`}
              >
                {redeemPoints ? "REDEEMING..." : "REDEEM POINTS"}
              </button>
            </motion.div>
          )}
        </div>

        {/* Product Search and Scanning Simulation */}
        <div className="bg-white p-6 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b-2 border-black pb-3">
            <h3 className="font-black uppercase text-black flex items-center gap-2 text-base">
              <Barcode className="w-4 h-4 text-black" />
              <span>Inventory Scanner & Lookup</span>
            </h3>
            
            {/* Instant add item trigger */}
            <button
              onClick={() => setShowAddProductModal(true)}
              className="text-xs font-black text-black hover:underline flex items-center gap-1 border-2 border-black bg-[#F5F2EB] hover:bg-zinc-100 px-3 py-1.5 rounded-none cursor-pointer font-mono"
            >
              <span>Product not found? Add it now</span>
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Search Dropdown Selector */}
            <div className="relative">
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Search products</label>
              <div className="relative">
                <Search className="absolute left-3 top-3.5 w-4 h-4 text-black" />
                <input 
                  type="text" 
                  placeholder="Search by name, category, or barcode..."
                  value={searchProductQuery}
                  onChange={(e) => setSearchProductQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border-2 border-black text-black placeholder-zinc-500 rounded-none text-sm font-bold focus:outline-none"
                />
              </div>

              {/* Dropdown list of filtered products */}
              {searchProductQuery && (
                <div className="absolute left-0 right-0 mt-1 bg-white border-2 border-black rounded-none shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] z-20 max-h-56 overflow-y-auto">
                  {filteredProducts.length === 0 ? (
                    <p className="p-4 text-sm text-zinc-600 font-bold italic text-center font-mono">No products found</p>
                  ) : (
                    filteredProducts.map((p) => (
                      <button
                        key={p.id}
                        disabled={p.quantity <= 0}
                        onClick={() => addToCart(p)}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#F5F2EB] border-b border-black flex items-center justify-between disabled:opacity-50 cursor-pointer font-mono font-bold text-black"
                      >
                        <div>
                          <p className="text-sm font-black text-black">{p.name}</p>
                          <p className="text-xs text-zinc-600 font-bold">Qty left: {p.quantity} | {currency}{p.sellingPrice}</p>
                        </div>
                        <span className="text-xs font-black text-[#0055A5]">SELECT +</span>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>

            {/* Barcode scanner simulation */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Scan Barcode / SKU</label>
              <div className="flex h-11 gap-2 items-stretch">
                <input 
                  type="text" 
                  placeholder="Scan SKU barcode e.g. 890123456001"
                  value={scannedCode}
                  onChange={(e) => setScannedCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleBarcodeScan()}
                  className={`flex-1 px-3 border-2 text-sm font-mono text-black rounded-none focus:outline-none font-bold ${
                    scanStatus === "success" ? "bg-[#E8F0FE] border-[#0055A5]" :
                    scanStatus === "error" ? "bg-[#FCE8E6] border-[#D63031]" :
                    "bg-white border-black"
                  }`}
                />
                <button 
                  onClick={() => handleBarcodeScan()}
                  className="px-5 bg-black hover:bg-zinc-800 text-white rounded-none border-2 border-black text-sm font-black transition-all flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Barcode className="w-4 h-4" />
                  <span>Scan</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick-add options during peak business hours */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-wider text-black font-mono mb-2">Peak Hours Quick-Add:</p>
            <div className="flex flex-wrap gap-2">
              {quickAddItems.map((p) => (
                <button
                  key={p.id}
                  onClick={() => addToCart(p)}
                  className="px-3.5 py-1.5 bg-white hover:bg-[#F5F2EB] border-2 border-black rounded-none text-xs font-black text-black transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>{p.name} ({currency}{p.sellingPrice})</span>
                  <Plus className="w-3.5 h-3.5 text-black" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected Items List */}
        <div className="bg-white p-6 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="font-black uppercase text-black flex items-center gap-2 mb-4 border-b-2 border-black pb-3 text-base">
            <ShoppingCart className="w-4 h-4 text-black" />
            <span>Items Selected for Checkout ({cart.length})</span>
          </h3>

          {cart.length === 0 ? (
            <div className="text-center py-12 text-zinc-600 bg-[#F5F2EB] border-2 border-black rounded-none flex flex-col items-center">
              <ShoppingCart className="w-10 h-10 stroke-1 mb-2 text-black" />
              <p className="text-sm font-black font-mono">No items in the billing cart</p>
              <p className="text-xs text-zinc-600 font-bold font-mono mt-1">Use lookup, scanner simulation, or quick-add keys to add items.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="hidden md:grid grid-cols-12 gap-4 text-[10px] font-black text-black uppercase tracking-wider font-mono border-b-2 border-black pb-2">
                <span className="col-span-5">Product Details</span>
                <span className="col-span-2 text-center">Quantity</span>
                <span className="col-span-3 text-center">Commission %</span>
                <span className="col-span-2 text-right">Price</span>
              </div>

              {cart.map((item, idx) => (
                <div key={item.product.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center border-b border-black pb-3 pt-1">
                  {/* Name & SKU */}
                  <div className="col-span-5">
                    <p className="text-sm font-black text-black">{item.product.name}</p>
                    <p className="text-xs text-zinc-600 font-bold font-mono">Category: {item.product.category} | SKU: {item.product.barcode}</p>
                  </div>

                  {/* Quantity adjustment */}
                  <div className="col-span-2 flex items-center justify-center gap-2">
                    <button 
                      onClick={() => updateCartQuantity(item.product.id, item.quantity - 1)}
                      className="w-7 h-7 rounded-none bg-white border-2 border-black hover:bg-[#F5F2EB] text-black font-black text-sm flex items-center justify-center transition-colors cursor-pointer"
                    >
                      -
                    </button>
                    <span className="text-sm font-black font-mono text-black">{item.quantity}</span>
                    <button 
                      onClick={() => updateCartQuantity(item.product.id, item.quantity + 1)}
                      className="w-7 h-7 rounded-none bg-white border-2 border-black hover:bg-[#F5F2EB] text-black font-black text-sm flex items-center justify-center transition-colors cursor-pointer"
                    >
                      +
                    </button>
                  </div>

                  {/* Commission Percent selection */}
                  <div className="col-span-3 flex flex-col items-center">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Percent className="w-3 h-3 text-black" />
                      <span className="text-xs font-black font-mono text-black">{item.commissionPercent}%</span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="30" 
                      step="5" 
                      value={item.commissionPercent}
                      onChange={(e) => updateItemCommissionPercent(item.product.id, parseInt(e.target.value))}
                      className="w-full h-1 bg-[#F5F2EB] border border-black rounded-none appearance-none cursor-pointer accent-[#D63031]"
                    />
                  </div>

                  {/* Price, Totals, and Delete */}
                  <div className="col-span-2 flex items-center justify-between md:justify-end gap-3 text-right">
                    <div className="flex flex-col items-end justify-center">
                      <div className="flex items-center border-2 border-black bg-white px-1 py-0.5 shadow-[1px_1px_0px_0px_rgba(0,0,0,1)]">
                        <span className="text-[9px] font-mono font-black text-zinc-600 mr-0.5">{currency}</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.price}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            updateCartItemPrice(item.product.id, isNaN(val) ? 0 : val);
                          }}
                          className="w-14 bg-transparent text-[11px] text-right font-mono font-black text-black focus:outline-none"
                        />
                      </div>
                      <p className="text-[11px] font-black text-zinc-800 font-mono mt-1">Total: {currency}{(item.price * item.quantity).toFixed(2)}</p>
                    </div>
                    <button 
                      onClick={() => removeFromCart(item.product.id)}
                      className="p-1.5 bg-white hover:bg-[#D63031] hover:text-white text-[#D63031] rounded-none border-2 border-black transition-all cursor-pointer shadow-[1px_1px_0px_0px_rgba(0,0,0,1)] hover:shadow-none hover:translate-x-[1px] hover:translate-y-[1px]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* RIGHT: Agent Commission, Tax Summary & Finalize Invoice */}
      <div className="w-full lg:w-96 space-y-6">
        
        {/* Commission Agent Registration */}
        <div className="bg-white p-6 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
          <h3 className="font-black uppercase text-black flex items-center gap-2 mb-4 border-b-2 border-black pb-3 text-base">
            <Percent className="w-4 h-4 text-black" />
            <span>Commission Referral</span>
          </h3>

          <div className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Agent Name</label>
              <input 
                type="text" 
                placeholder="Name of Referrer / Agent"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border-2 border-black text-black placeholder-zinc-500 rounded-none text-sm font-bold focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Agent Phone Number</label>
              <input 
                type="text" 
                placeholder="Enter 10-digit Phone"
                value={agentPhone}
                onChange={(e) => setAgentPhone(e.target.value)}
                className="w-full px-3 py-2.5 bg-white border-2 border-black text-black placeholder-zinc-500 rounded-none text-sm font-bold focus:outline-none"
              />
            </div>

            {agentName && totalCommission > 0 && (
              <div className="p-3 bg-[#E8F0FE] border-2 border-black rounded-none flex items-center justify-between text-black">
                <div>
                  <p className="text-[10px] text-blue-900 font-black uppercase tracking-wider font-mono">Commission accrued</p>
                  <p className="text-sm font-black text-black font-mono mt-0.5">{currency}{totalCommission.toFixed(2)}</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 font-black bg-white text-[#0055A5] border-2 border-black rounded-none font-mono">
                  Pending Prompt
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Checkout Summary */}
        <div className="bg-white p-6 rounded-none border-3 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex flex-col justify-between">
          <div>
            <h3 className="font-black uppercase text-black mb-4 border-b-2 border-black pb-3 text-base">
              Tax & Checkout Summary
            </h3>

            {/* Optional Tax Switcher */}
            <div className="flex items-center justify-between p-3 bg-[#F5F2EB] border-2 border-black rounded-none mb-4 text-sm text-black font-bold font-mono">
              <span>APPLY TAX ({defaultTaxRate}%)</span>
              <button
                type="button"
                onClick={() => setIsTaxEnabled(!isTaxEnabled)}
                className={`w-12 h-6 border-2 border-black rounded-none p-0.5 transition-colors duration-200 focus:outline-none cursor-pointer ${
                  isTaxEnabled ? "bg-black" : "bg-white"
                }`}
              >
                <div className={`w-4 h-4 rounded-none transition-transform duration-200 ${isTaxEnabled ? "translate-x-6 bg-white" : "translate-x-0 bg-black"}`} />
              </button>
            </div>

            {/* Payment Method Selector */}
            <div className="mb-4">
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">Payment Method</label>
              <select 
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full px-3 py-2 bg-white border-2 border-black text-black rounded-none text-sm font-bold focus:outline-none cursor-pointer"
              >
                <option value="Cash">Cash Payment</option>
                <option value="Card">Credit/Debit Card</option>
                <option value="UPI">UPI Mobile Scan</option>
                <option value="Cheque">Cheque Payment</option>
                <option value="Loyalty Points">Loyalty points Wallet</option>
                <option value="Store Credit">Store Credit / Unpaid</option>
              </select>
            </div>
            {paymentMethod === "Store Credit" && <div className="mb-4"><label className="block text-[10px] font-black uppercase mb-1.5">Amount received now ({currency})</label><input type="number" min="0" max={totalAmount} step="0.01" value={initialPaymentReceived} onChange={e=>setInitialPaymentReceived(e.target.value)} className="w-full px-3 py-2 border-2 border-black" placeholder="0.00"/><p className="text-[10px] font-bold mt-1">Customer due: {currency}{Math.max(0,totalAmount-Math.min(totalAmount,Number(initialPaymentReceived||0))).toFixed(2)}</p></div>}

            {/* Manual Discount Input */}
            <div className="mb-4">
              <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1.5">
                Manual Discount / Adjustment ({currency})
              </label>
              <div className="flex items-center border-2 border-black bg-white px-2.5 py-1.5 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                <span className="text-xs font-mono font-black text-zinc-500 mr-1.5">{currency}</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={customDiscount || ""}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setCustomDiscount(isNaN(val) ? 0 : val);
                  }}
                  className="w-full bg-transparent text-sm font-mono font-bold text-black focus:outline-none"
                />
              </div>
            </div>

            {/* Financial Calculations list */}
            <div className="space-y-2 border-b-2 border-black pb-4 mb-4">
              <div className="flex justify-between text-sm text-black font-mono font-bold">
                <span>Subtotal:</span>
                <span>{currency}{subtotal.toFixed(2)}</span>
              </div>
              
              {redeemPoints && matchedCustomer && (
                <div className="flex justify-between text-sm text-[#D63031] font-mono font-black">
                  <span>Loyalty Discount:</span>
                  <span>-{currency}{discountAmount.toFixed(2)}</span>
                </div>
              )}

              {customDiscount > 0 && (
                <div className="flex justify-between text-sm text-[#D63031] font-mono font-black">
                  <span>Manual Discount:</span>
                  <span>-{currency}{customDiscount.toFixed(2)}</span>
                </div>
              )}

              {isTaxEnabled && (
                <div className="flex justify-between text-sm text-black font-mono font-bold">
                  <span>Tax Amount:</span>
                  <span>{currency}{taxAmount.toFixed(2)}</span>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-lg font-black text-black tracking-tight mb-6 font-mono">
              <span>GRAND TOTAL:</span>
              <span className="text-xl text-[#0055A5] font-black">{currency}{totalAmount.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
            </div>
          </div>

          <button
            onClick={() => handleFinalize()}
            disabled={cart.length === 0}
            className="w-full py-3 bg-[#D63031] hover:bg-[#E54849] text-white disabled:bg-zinc-100 disabled:border-zinc-300 disabled:text-zinc-400 rounded-none border-2 border-black font-black transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] flex items-center justify-center gap-2 cursor-pointer"
          >
            <Check className="w-5 h-5" />
            <span>FINALIZE BILL INVOICE</span>
          </button>
        </div>

      </div>

          </div>
        </div>
      )}

      {/* INSTANT PRODUCT CREATION MODAL */}
      <AnimatePresence>
        {showAddProductModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md p-6 rounded-none border-3 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-4 text-black"
            >
              <div className="flex justify-between items-center border-b-2 border-black pb-3">
                <h3 className="font-black uppercase text-black text-lg">Instant Add Product</h3>
                <button 
                  onClick={() => setShowAddProductModal(false)}
                  className="p-1 border-2 border-black bg-white hover:bg-[#F5F2EB] text-black font-black cursor-pointer w-7 h-7 flex items-center justify-center rounded-none"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleInstantProductAdd} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Product Name</label>
                  <input 
                    type="text" 
                    required
                    value={newProdName}
                    onChange={(e) => setNewProdName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-black rounded-none text-sm text-black font-bold focus:outline-none placeholder-zinc-500"
                    placeholder="e.g. Vintage Leather Boots"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Category</label>
                    <select 
                      value={newProdCategory}
                      onChange={(e) => setNewProdCategory(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-black rounded-none text-sm text-black font-bold focus:outline-none cursor-pointer"
                    >
                      <option value="Apparel">Apparel</option>
                      <option value="Electronics">Electronics</option>
                      <option value="Furniture">Furniture</option>
                      <option value="Groceries">Groceries</option>
                      <option value="Kitchenware">Kitchenware</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Stock Quantity</label>
                    <input 
                      type="number" 
                      required
                      value={newProdQuantity}
                      onChange={(e) => setNewProdQuantity(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-black rounded-none text-sm text-black font-bold focus:outline-none"
                      placeholder="e.g. 20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Cost Price (Purchase)</label>
                    <input 
                      type="number" 
                      required
                      value={newProdPurchasePrice}
                      onChange={(e) => setNewProdPurchasePrice(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-black rounded-none text-sm text-black font-bold focus:outline-none"
                      placeholder="e.g. 15"
                    />
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Selling Price (MRP)</label>
                    <input 
                      type="number" 
                      required
                      value={newProdSellingPrice}
                      onChange={(e) => setNewProdSellingPrice(e.target.value)}
                      className="w-full px-3 py-2 bg-white border-2 border-black rounded-none text-sm text-black font-bold focus:outline-none"
                      placeholder="e.g. 45"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase tracking-wider text-black font-mono mb-1">Barcode / SKU (Optional)</label>
                  <input 
                    type="text" 
                    value={newProdBarcode}
                    onChange={(e) => setNewProdBarcode(e.target.value)}
                    className="w-full px-3 py-2 bg-white border-2 border-black rounded-none text-sm font-mono text-black font-bold focus:outline-none"
                    placeholder="Generates auto if empty"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full py-2.5 bg-[#0055A5] hover:bg-[#004488] text-white border-2 border-black rounded-none text-sm font-black transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                  INSTANT ONBOARD PRODUCT
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROMPT: GENERATE COMMISSION */}
      <AnimatePresence>
        {showCommissionPrompt && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-sm p-6 rounded-none border-3 border-black shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center space-y-4 text-black"
            >
              <div className="mx-auto w-12 h-12 rounded-none bg-white text-black flex items-center justify-center border-2 border-black">
                <Percent className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-black uppercase text-black text-lg">Generate Commission?</h3>
                <p className="text-sm text-zinc-700 mt-1 font-bold">Generate commission in the name of agent <strong className="text-black font-black">{agentName}</strong>? The calculated commission amount is <strong className="text-[#0055A5] font-mono font-black">{currency}{totalCommission.toFixed(2)}</strong>.</p>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button 
                  onClick={() => handleCommissionConfirmation(false)}
                  className="py-2.5 bg-white border-2 border-black hover:bg-zinc-100 text-black rounded-none text-sm font-black transition-all cursor-pointer"
                >
                  No, Skip
                </button>
                <button 
                  onClick={() => handleCommissionConfirmation(true)}
                  className="py-2.5 bg-[#D63031] hover:bg-[#E54849] text-white rounded-none border-2 border-black text-sm font-black transition-all shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                >
                  Yes, Generate
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SMS SIMULATOR PHONE OVERLAY */}
      <AnimatePresence>
        {showSmsSimulator && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="w-full max-w-[320px] bg-black border-[12px] border-black rounded-none h-[580px] shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] relative overflow-hidden flex flex-col justify-between"
            >
              {/* Phone Speaker & Camera notch */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-zinc-800 rounded-none z-30 flex justify-center items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-900" />
                <span className="w-12 h-1 bg-slate-900 rounded-none" />
              </div>

              {/* Status Bar */}
              <div className="pt-8 px-6 pb-2 bg-zinc-900 text-white flex justify-between items-center text-[11px] font-semibold font-mono z-20">
                <span>12:00 PM</span>
                <span>LTE</span>
              </div>

              {/* Messaging Screen area */}
              <div className="flex-1 bg-[#121212] p-4 space-y-4 overflow-y-auto">
                <div className="text-center pt-2">
                  <p className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">Today, 12:00 PM</p>
                </div>
                
                {/* Simulated SMS Bubble */}
                <div className="flex items-start gap-2">
                  <div className="w-7 h-7 rounded-none border border-white bg-zinc-800 text-white text-[11px] font-bold flex items-center justify-center">
                    {shopName.charAt(0)}
                  </div>
                  <div className="flex-1 bg-[#222] border-2 border-white text-white p-3.5 rounded-none text-xs leading-relaxed shadow">
                    <p className="font-black text-white mb-1 uppercase tracking-tight">{shopName}</p>
                    <p className="text-zinc-300 font-mono text-[11px]">{simulatedSmsText}</p>
                    <span className="block text-[10px] text-right text-emerald-400 mt-2 font-mono">Status: Delivered ✅</span>
                  </div>
                </div>
              </div>

              {/* Bottom input simulation bar */}
              <div className="p-4 bg-zinc-900 border-t border-[#262626] text-center space-y-3">
                <p className="text-[10px] text-zinc-400 font-mono">Automatic text-message triggered to agent</p>
                <button 
                  onClick={() => closeSmsSimulator()}
                  className="w-full py-2 bg-white hover:bg-[#FCE8E6] hover:text-[#D63031] text-black rounded-none border-2 border-black text-xs font-black transition-all cursor-pointer"
                >
                  Continue to Invoice Receipt
                </button>
              </div>

              {/* Bottom home handle bar */}
              <div className="pb-3 pt-1 bg-zinc-900 flex justify-center">
                <div className="w-24 h-1 bg-zinc-700 rounded-none" />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FINAL STEP: RECEIPT OPTIONS (PDF download or Clipboard copy - agent data is completely hidden) */}
      <AnimatePresence>
        {showInvoiceDownloadOptions && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md p-6 rounded-none border-3 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-5 text-black"
            >
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-none bg-[#FFC300] text-black border-2 border-black flex items-center justify-center">
                  <FileText className="w-6 h-6" />
                </div>
                <h3 className="font-black uppercase text-black text-lg tracking-tight">Invoice Processed Successfully</h3>
                <p className="text-sm text-zinc-700 font-bold">Select an option below to deliver the invoice to your customer. For security & confidentiality, agent commissions are hidden from customer invoices.</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => {
                    setPreviewSale(finalizedSale);
                    setSelectedInvoiceStyle('classic');
                    setShowPrintPreviewModal(true);
                  }}
                  className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-black hover:bg-[#F5F2EB] bg-white rounded-none transition-all group cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Download className="w-6 h-6 text-black transition-colors" />
                  <span className="text-xs font-black text-black">Download PDF</span>
                </button>
                <button 
                  onClick={() => copyBillToClipboard()}
                  className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-black hover:bg-[#F5F2EB] bg-white rounded-none transition-all group cursor-pointer shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]"
                >
                  <Clipboard className="w-6 h-6 text-black transition-colors" />
                  <span className="text-xs font-black text-black">Copy Bill Text</span>
                </button>
              </div>

              <button 
                onClick={() => handleFinishSession()}
                className="w-full py-2.5 bg-[#D63031] hover:bg-[#E54849] text-white rounded-none border-2 border-black text-sm font-black transition-all shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
              >
                CLOSE & NEXT TRANSACTION
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PRINT PREVIEW MODAL */}
      <AnimatePresence>
        {showPrintPreviewModal && previewSale && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              className="bg-[#faf9f6] w-full max-w-5xl rounded-none border-4 border-black shadow-[10px_10px_0px_0px_rgba(0,0,0,1)] flex flex-col md:flex-row text-black overflow-hidden max-h-[90vh]"
            >
              {/* Left Side: Style Selector Controls */}
              <div className="w-full md:w-2/5 p-6 bg-white border-b-4 md:border-b-0 md:border-r-4 border-black flex flex-col justify-between overflow-y-auto">
                <div className="space-y-6">
                  <div className="flex items-center gap-2 pb-3 border-b-2 border-dashed border-zinc-200">
                    <Printer className="w-6 h-6 text-[#FFC300]" />
                    <div>
                      <h3 className="font-black uppercase text-base tracking-tight">Invoice Print Preview</h3>
                      <p className="text-[10px] text-zinc-500 font-bold font-mono">Live dynamic mockup rendering</p>
                    </div>
                  </div>

                  {/* Choose Theme */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase text-zinc-700 tracking-wider block">
                      Select Bill Template Style
                    </label>
                    <div className="space-y-2.5">
                      {[
                        { 
                          id: 'classic', 
                          name: 'Classic Corporate', 
                          desc: 'Standard A4 blueprint. Slate accents, clear structured grids, professional layout.',
                          badge: 'Professional'
                        },
                        { 
                          id: 'thermal', 
                          name: 'Retro POS Thermal', 
                          desc: 'Compact 80mm register roll. Monospaced typography, dashed dividers, vintage shop feel.',
                          badge: 'Highly Requested'
                        },
                        { 
                          id: 'modern', 
                          name: 'Modern Teal Accent', 
                          desc: 'Sophisticated template. Vibrant teal details, premium user card grids, stylish layouts.',
                          badge: 'Elegant'
                        },
                        { 
                          id: 'minimalist', 
                          name: 'Minimalist B&W', 
                          desc: 'Ultra high-contrast fashion style. Hairline thin rules, wide margins, sophisticated text layout.',
                          badge: 'Sleek'
                        }
                      ].map((styleOption) => (
                        <button
                          key={styleOption.id}
                          onClick={() => setSelectedInvoiceStyle(styleOption.id as any)}
                          className={`w-full text-left p-3 border-2 transition-all flex flex-col justify-between cursor-pointer rounded-none relative ${
                            selectedInvoiceStyle === styleOption.id 
                              ? 'border-black bg-[#FFC300] shadow-[3px_3px_0px_0px_rgba(0,0,0,1)]' 
                              : 'border-zinc-300 hover:border-black bg-white'
                          }`}
                        >
                          <div className="flex justify-between items-center w-full mb-1">
                            <span className="text-xs font-black uppercase tracking-tight">{styleOption.name}</span>
                            <span className={`text-[8px] font-mono font-bold px-1.5 py-0.5 border border-black uppercase ${
                              selectedInvoiceStyle === styleOption.id ? 'bg-black text-[#FFC300]' : 'bg-zinc-100 text-zinc-600'
                            }`}>
                              {styleOption.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-800 leading-normal font-bold">
                            {styleOption.desc}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Security Note */}
                  <div className="p-3 bg-zinc-50 border border-zinc-200 text-[10px] text-zinc-600 space-y-1 rounded-none font-medium">
                    <span className="font-black text-black block uppercase">🛡️ Privacy Shield Active</span>
                    To ensure secure business operations and employee confidentiality, agent identity and commission calculations are strictly omitted from all customer bills.
                  </div>
                </div>

                {/* Actions */}
                <div className="mt-6 pt-4 border-t-2 border-zinc-200 space-y-3">
                  <button
                    onClick={() => {
                      generatePdfInvoice(previewSale, selectedInvoiceStyle);
                    }}
                    className="w-full py-3 bg-[#FFC300] hover:bg-[#E5B000] text-black border-2 border-black rounded-none text-xs font-black transition-all flex items-center justify-center gap-2 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    DOWNLOAD STYLED PDF
                  </button>

                  <button
                    onClick={() => {
                      copyBillToClipboard(previewSale);
                    }}
                    className="w-full py-2.5 hover:bg-zinc-100 text-black bg-white border-2 border-zinc-300 hover:border-black rounded-none text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy Raw Plain Text Bill
                  </button>

                  <button
                    onClick={() => setShowPrintPreviewModal(false)}
                    className="w-full py-2 text-zinc-500 hover:text-black font-bold font-mono text-center text-[11px] hover:underline cursor-pointer"
                  >
                    ← Back to Transaction
                  </button>
                </div>
              </div>

              {/* Right Side: Scrollable Bill Mockup Viewport */}
              <div className="w-full md:w-3/5 p-6 overflow-y-auto bg-zinc-800 flex items-center justify-center min-h-[400px] md:max-h-[90vh]">
                <div className="w-full max-w-[430px] shadow-2xl transition-all duration-300">
                  
                  {/* CLASSIC STYLE MOCKUP */}
                  {selectedInvoiceStyle === 'classic' && (
                    <div className="bg-white border-2 border-black p-6 font-sans text-xs space-y-4 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.25)] text-zinc-800">
                      <div className="flex justify-between items-start border-b border-zinc-200 pb-3">
                        <div>
                          <h4 className="text-zinc-900 font-black text-lg tracking-tight">{shopName}</h4>
                          <p className="text-[10px] text-zinc-500 font-semibold">Official Invoice Receipt</p>
                        </div>
                        <div className="text-right text-[10px] space-y-0.5">
                          <p className="font-bold text-zinc-900">DATE: {new Date(previewSale.timestamp).toLocaleDateString()}</p>
                          <p className="text-zinc-500 font-mono">INV: #{previewSale.id.slice(0, 10)}...</p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <p className="text-[10px] font-black uppercase text-zinc-400">BILL TO:</p>
                        <p className="font-bold text-zinc-900">{previewSale.customerName}</p>
                        <p className="text-zinc-600 font-medium">Phone: {previewSale.customerPhone}</p>
                        <p className="text-zinc-600 font-medium">Payment Mode: <span className="font-black text-black">{previewSale.paymentMethod}</span></p>
                      </div>

                      {/* Items Grid */}
                      <div className="border border-zinc-200">
                        <div className="grid grid-cols-12 bg-zinc-100 p-2 font-black text-[9px] uppercase tracking-wider text-zinc-600 border-b border-zinc-200">
                          <div className="col-span-6">Product</div>
                          <div className="col-span-2 text-center">Qty</div>
                          <div className="col-span-2 text-right">Unit</div>
                          <div className="col-span-2 text-right">Total</div>
                        </div>
                        <div className="divide-y divide-zinc-100">
                          {previewSale.items.map((item, idx) => (
                            <div key={idx} className="grid grid-cols-12 p-2 text-[11px] font-medium text-zinc-700">
                              <div className="col-span-6 font-bold text-zinc-950">{item.name}</div>
                              <div className="col-span-2 text-center">{item.quantity}</div>
                              <div className="col-span-2 text-right">{currency}{item.price.toFixed(2)}</div>
                              <div className="col-span-2 text-right font-bold text-zinc-950">{currency}{(item.price * item.quantity).toFixed(2)}</div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Summary calculations */}
                      <div className="flex justify-end pt-2">
                        <div className="w-1/2 space-y-1.5 text-right font-medium text-zinc-600">
                          <div className="flex justify-between">
                            <span>Subtotal:</span>
                            <span className="font-bold text-zinc-900">{currency}{previewSale.subtotal.toFixed(2)}</span>
                          </div>
                          {previewSale.taxAmount > 0 && (
                            <div className="flex justify-between">
                              <span>Tax ({previewSale.taxRate}%):</span>
                              <span className="font-bold text-zinc-900">{currency}{previewSale.taxAmount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between border-t border-zinc-200 pt-2 text-sm font-black">
                            <span className="text-zinc-900 uppercase">Grand Total:</span>
                            <span className="text-blue-600">{currency}{previewSale.totalAmount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[9px] text-zinc-400 italic text-center pt-4 border-t border-dashed border-zinc-100">
                        Thank you for your business! Automatically processed via Retail Sync.
                      </p>
                    </div>
                  )}

                  {/* THERMAL POS STYLE MOCKUP */}
                  {selectedInvoiceStyle === 'thermal' && (
                    <div className="bg-[#fefefe] border-2 border-dashed border-zinc-400 p-5 font-mono text-[11px] leading-relaxed text-black shadow-[4px_4px_0px_0px_rgba(0,0,0,0.25)] relative overflow-hidden">
                      {/* Thermal Paper roll gloss overlay */}
                      <div className="absolute inset-x-0 top-0 h-4 bg-gradient-to-b from-black/[0.03] to-transparent" />
                      
                      <div className="text-center space-y-1 pb-2 border-b border-dashed border-zinc-300">
                        <h4 className="font-black text-sm tracking-wider uppercase">{shopName}</h4>
                        <p className="text-[9px] tracking-widest font-bold">OFFICIAL RECEIPT</p>
                        <p className="text-[9px]">================================</p>
                      </div>

                      <div className="space-y-1 py-2 text-[10px] font-bold">
                        <p>INV: {previewSale.id.slice(0, 16)}</p>
                        <p>DATE: {new Date(previewSale.timestamp).toLocaleDateString()}</p>
                        <p>TIME: {new Date(previewSale.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <p>CUST: {previewSale.customerName.toUpperCase()}</p>
                        <p>PAYMENT: {previewSale.paymentMethod.toUpperCase()}</p>
                      </div>

                      <p className="text-[9px]">--------------------------------</p>
                      
                      {/* Monospaced Grid */}
                      <div className="space-y-1">
                        <div className="flex justify-between font-black text-[9px]">
                          <span className="w-1/2">ITEM</span>
                          <span className="w-1/12 text-center">QTY</span>
                          <span className="w-1/4 text-right">PRICE</span>
                          <span className="w-1/4 text-right">TOTAL</span>
                        </div>
                        <p className="text-[9px]">--------------------------------</p>
                        {previewSale.items.map((item, idx) => (
                          <div key={idx} className="space-y-0.5">
                            <p className="font-black uppercase">{item.name}</p>
                            <div className="flex justify-between text-[10px] pl-2 text-zinc-700">
                              <span>{item.quantity} x {currency}{item.price.toFixed(2)}</span>
                              <span className="font-bold text-black">{currency}{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          </div>
                        ))}
                      </div>

                      <p className="text-[9px] pt-2">--------------------------------</p>

                      <div className="space-y-1 text-right text-[10px] font-bold py-1">
                        <div className="flex justify-between">
                          <span>SUBTOTAL:</span>
                          <span>{currency}{previewSale.subtotal.toFixed(2)}</span>
                        </div>
                        {previewSale.taxAmount > 0 && (
                          <div className="flex justify-between">
                            <span>TAX ({previewSale.taxRate}%):</span>
                            <span>{currency}{previewSale.taxAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[11px] font-black border-t border-dashed border-zinc-300 pt-1">
                          <span>TOTAL DUE:</span>
                          <span>{currency}{previewSale.totalAmount.toFixed(2)}</span>
                        </div>
                      </div>

                      <div className="text-center space-y-1 pt-3 border-t border-dashed border-zinc-300 text-[9px] font-bold">
                        <p>THANK YOU FOR YOUR VISIT!</p>
                        <p>HAVE A WONDERFUL DAY</p>
                      </div>
                    </div>
                  )}

                  {/* MODERN ELEGANT MOCKUP */}
                  {selectedInvoiceStyle === 'modern' && (
                    <div className="bg-white rounded-none border-2 border-black overflow-hidden shadow-[4px_4px_0px_0px_rgba(0,0,0,0.25)] text-zinc-800 font-sans text-xs">
                      {/* Top Accent bar */}
                      <div className="h-2.5 bg-teal-600 w-full" />
                      
                      <div className="p-6 space-y-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="text-zinc-900 font-black text-xl tracking-tight uppercase">{shopName}</h4>
                            <span className="text-[8px] font-bold tracking-widest text-teal-600 bg-teal-50 border border-teal-100 px-2 py-0.5 uppercase font-sans">
                              Elegant Receipt
                            </span>
                          </div>
                          <div className="text-right text-[10px] space-y-0.5 font-bold">
                            <p className="text-zinc-400">DATE: <span className="text-zinc-800">{new Date(previewSale.timestamp).toLocaleDateString()}</span></p>
                            <p className="text-zinc-400">ID: <span className="text-zinc-800 font-mono">{previewSale.id.slice(0, 10)}</span></p>
                          </div>
                        </div>

                        {/* Customer billing info card */}
                        <div className="bg-teal-50/50 border border-teal-100 p-3 flex justify-between rounded-none gap-2">
                          <div className="space-y-0.5">
                            <p className="text-[8px] font-black text-teal-600 uppercase tracking-wider">PREPARED FOR:</p>
                            <p className="font-extrabold text-zinc-900">{previewSale.customerName}</p>
                            <p className="text-zinc-600 text-[10px] font-medium">Ph: {previewSale.customerPhone}</p>
                          </div>
                          <div className="text-right space-y-0.5">
                            <p className="text-[8px] font-black text-teal-600 uppercase tracking-wider">PAYMENT:</p>
                            <p className="font-extrabold text-zinc-900">{previewSale.paymentMethod}</p>
                          </div>
                        </div>

                        {/* Teal Styled Table */}
                        <div className="overflow-hidden">
                          <div className="grid grid-cols-12 bg-teal-600 text-white p-2 font-black text-[9px] uppercase tracking-wider rounded-none">
                            <div className="col-span-6">Product name</div>
                            <div className="col-span-2 text-center">Qty</div>
                            <div className="col-span-2 text-right">Unit</div>
                            <div className="col-span-2 text-right">Total</div>
                          </div>
                          <div className="divide-y divide-zinc-100 border-x border-b border-zinc-100">
                            {previewSale.items.map((item, idx) => (
                              <div key={idx} className={`grid grid-cols-12 p-2 text-[11px] font-semibold text-zinc-700 ${
                                idx % 2 === 1 ? 'bg-zinc-50/50' : 'bg-white'
                              }`}>
                                <div className="col-span-6 font-bold text-zinc-900">{item.name}</div>
                                <div className="col-span-2 text-center text-zinc-900">{item.quantity}</div>
                                <div className="col-span-2 text-right">{currency}{item.price.toFixed(2)}</div>
                                <div className="col-span-2 text-right font-extrabold text-zinc-900">{currency}{(item.price * item.quantity).toFixed(2)}</div>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Teal Totals Box */}
                        <div className="flex justify-end pt-1">
                          <div className="w-1/2 space-y-1 text-right font-semibold text-zinc-500">
                            <div className="flex justify-between">
                              <span>Subtotal:</span>
                              <span className="font-extrabold text-zinc-800">{currency}{previewSale.subtotal.toFixed(2)}</span>
                            </div>
                            {previewSale.taxAmount > 0 && (
                              <div className="flex justify-between">
                                <span>Tax ({previewSale.taxRate}%):</span>
                                <span className="font-extrabold text-zinc-800">{currency}{previewSale.taxAmount.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex justify-between items-center bg-teal-50/70 border border-teal-100 p-1.5 font-black text-zinc-900 mt-2 text-xs">
                              <span className="text-[10px] text-teal-700 uppercase">Grand Total:</span>
                              <span className="text-teal-600 text-sm font-black">{currency}{previewSale.totalAmount.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        <p className="text-[8px] text-zinc-400 font-bold italic text-center pt-2 border-t border-dashed border-zinc-100 uppercase tracking-wider">
                          Thank you for your valuable patronage! Generated with pride via Retail Sync.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* MINIMALIST CLEAN STYLE MOCKUP */}
                  {selectedInvoiceStyle === 'minimalist' && (
                    <div className="bg-white border border-zinc-200 p-6 font-sans text-xs space-y-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,0.25)] text-black">
                      <div className="space-y-1">
                        <h4 className="font-bold text-base uppercase tracking-widest">{shopName}</h4>
                        <p className="text-[8px] tracking-widest font-mono text-zinc-400">OFFICIAL RECORD</p>
                      </div>

                      <div className="border-t border-black pt-3 flex justify-between items-start text-[10px]">
                        <div className="space-y-0.5">
                          <p className="font-bold text-zinc-500">CLIENT</p>
                          <p className="font-bold text-black uppercase">{previewSale.customerName}</p>
                          <p className="text-zinc-600">PH: {previewSale.customerPhone}</p>
                        </div>
                        <div className="text-right space-y-0.5">
                          <p className="font-bold text-zinc-500">DETAILS</p>
                          <p className="font-mono text-black">INV ID: #{previewSale.id.slice(0, 8).toUpperCase()}</p>
                          <p className="text-zinc-600">DATE: {new Date(previewSale.timestamp).toLocaleDateString()}</p>
                          <p className="text-zinc-600">PMT: {previewSale.paymentMethod.toUpperCase()}</p>
                        </div>
                      </div>

                      {/* Clean Grid */}
                      <div className="border-t border-black pt-3 space-y-2">
                        <div className="flex justify-between font-bold text-[9px] text-zinc-400 uppercase tracking-widest">
                          <span className="w-1/2">Description</span>
                          <span className="w-1/12 text-center">Qty</span>
                          <span className="w-1/4 text-right">Unit</span>
                          <span className="w-1/4 text-right">Total</span>
                        </div>
                        
                        <div className="space-y-2 pt-1 border-t border-zinc-100">
                          {previewSale.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between items-center text-[10px] font-bold">
                              <span className="w-1/2 uppercase text-black font-semibold">{item.name}</span>
                              <span className="w-1/12 text-center text-zinc-600 font-mono">{item.quantity}</span>
                              <span className="w-1/4 text-right text-zinc-600 font-mono">{currency}{item.price.toFixed(2)}</span>
                              <span className="w-1/4 text-right font-mono">{currency}{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="border-t border-black pt-3 flex justify-end">
                        <div className="w-1/2 space-y-1 text-right text-[10px] font-bold">
                          <div className="flex justify-between text-zinc-500">
                            <span>SUBTOTAL:</span>
                            <span className="font-mono text-black">{currency}{previewSale.subtotal.toFixed(2)}</span>
                          </div>
                          {previewSale.taxAmount > 0 && (
                            <div className="flex justify-between text-zinc-500">
                              <span>TAX ({previewSale.taxRate}%):</span>
                              <span className="font-mono text-black">{currency}{previewSale.taxAmount.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-[11px] pt-2 border-t border-zinc-100">
                            <span>GRAND TOTAL:</span>
                            <span className="font-mono text-black">{currency}{previewSale.totalAmount.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-zinc-200 flex justify-between items-center text-[8px] font-mono tracking-widest text-zinc-400 uppercase">
                        <span>WWW.RETAILSYNC.IO</span>
                        <span>THANK YOU</span>
                      </div>
                    </div>
                  )}

                </div>
              </div>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
