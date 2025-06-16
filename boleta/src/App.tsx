import React, { useState, useEffect, useRef } from 'react';
import { Upload, FileText, Image, Phone, Mail, Globe, MessageCircle, Facebook, Trash2, GripVertical, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import Sortable from 'sortablejs';

interface BoletaData {
  issueDate: string;
  issueTime: string;
  numeroBoleta: string;
  rucEmisor: string;
  nombreEmisor: string;
  nombreLegalEmisor: string;
  cliente: string;
  documentoCliente: string;
  tipoDocumentoCliente: string;
  numeroDocumentoCliente: string;
  total: string;
  moneda: string;
  montoLetras: string;
  tipoComprobante: string;
  direccionCompleta?: string;
  items: Array<{
    descripcion: string;
    cantidad: string;
    unidad: string;
    precio: string;
    total: string;
  }>;
  impuestos: {
    gravada: string;
    exonerada: string;
    inafecta: string;
    isc: string;
    igv: string;
    otrosCargos: string;
    otrosTributos: string;
    redondeo: string;
  };
}

interface CustomDataItem {
  iconClass: string;
  text: string;
}

const iconOptions = [
  { class: 'mail', icon: Mail, label: 'Correo' },
  { class: 'phone', icon: Phone, label: 'Teléfono' },
  { class: 'whatsapp', icon: MessageCircle, label: 'WhatsApp' },
  { class: 'globe', icon: Globe, label: 'Web' },
  { class: 'facebook', icon: Facebook, label: 'Facebook' }
];

function App() {
  const [xmlData, setXmlData] = useState<string | null>(null);
  const [boletaData, setBoletaData] = useState<BoletaData | null>(null);
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [customData, setCustomData] = useState<CustomDataItem[]>([]);
  const [selectedIcon, setSelectedIcon] = useState<string>('mail');
  const [customText, setCustomText] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [qrCodeBase64, setQrCodeBase64] = useState<string>('');
  const customDataRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedLogo = localStorage.getItem('sunatLogo');
    const savedCustomData = localStorage.getItem('sunatCustomData');
    
    if (savedLogo) setLogoBase64(savedLogo);
    if (savedCustomData) setCustomData(JSON.parse(savedCustomData));
  }, []);

  useEffect(() => {
    if (customDataRef.current) {
      new Sortable(customDataRef.current, {
        animation: 150,
        handle: '.drag-handle',
        onEnd: (evt) => {
          const newCustomData = [...customData];
          const [removed] = newCustomData.splice(evt.oldIndex!, 1);
          newCustomData.splice(evt.newIndex!, 0, removed);
          setCustomData(newCustomData);
          localStorage.setItem('sunatCustomData', JSON.stringify(newCustomData));
        }
      });
    }
  }, [customData]);

  const handleXMLUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const decoder = new TextDecoder('iso-8859-1');
      const xmlContent = decoder.decode(e.target!.result as ArrayBuffer);
      setXmlData(xmlContent);
      parseXML(xmlContent);
    };
    reader.readAsArrayBuffer(file);
  };

  const handleLogoUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target!.result as string;
      setLogoBase64(base64);
      localStorage.setItem('sunatLogo', base64);
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoBase64('');
    localStorage.removeItem('sunatLogo');
  };

  const addCustomData = () => {
    if (!customText.trim()) return;
    
    const newData = { iconClass: selectedIcon, text: customText.trim() };
    const updatedData = [...customData, newData];
    setCustomData(updatedData);
    localStorage.setItem('sunatCustomData', JSON.stringify(updatedData));
    setCustomText('');
  };

  const removeCustomData = (index: number) => {
    const updatedData = customData.filter((_, i) => i !== index);
    setCustomData(updatedData);
    localStorage.setItem('sunatCustomData', JSON.stringify(updatedData));
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (amount: string) => {
    return parseFloat(amount).toFixed(2);
  };

  const generateQRCode = async (dataUrl: string) => {
    try {
      const response = await fetch(`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(dataUrl)}&size=150x150`);
      const blob = await response.blob();
      return new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      return '';
    }
  };

  // Helper function to get icon symbol for PDF
  const getIconSymbol = (iconClass: string) => {
    const iconMap: { [key: string]: string } = {
      mail: '✉',
      phone: '☎',
      whatsapp: '📱',
      globe: '🌐',
      facebook: '📘'
    };
    return iconMap[iconClass] || '•';
  };

  // Helper function to convert image to proper format for PDF
  const getImageFormat = (base64String: string) => {
    if (base64String.includes('data:image/png')) return 'PNG';
    if (base64String.includes('data:image/gif')) return 'GIF';
    return 'JPEG';
  };

  const parseXML = async (xml: string) => {
    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xml, "text/xml");

      const legalTotal = xmlDoc.querySelector('LegalMonetaryTotal');

      const newBoletaData: BoletaData = {
        issueDate: xmlDoc.querySelector('IssueDate')?.textContent || '',
        issueTime: xmlDoc.querySelector('IssueTime')?.textContent?.substring(0, 5) || '',
        numeroBoleta: xmlDoc.querySelector('ID')?.textContent || '',
        rucEmisor: xmlDoc.querySelector('AccountingSupplierParty PartyIdentification ID')?.textContent || '',
        nombreEmisor: xmlDoc.querySelector('AccountingSupplierParty PartyName Name')?.textContent || '',
        nombreLegalEmisor: xmlDoc.querySelector('AccountingSupplierParty PartyLegalEntity RegistrationName')?.textContent || '',
        cliente: xmlDoc.querySelector('AccountingCustomerParty PartyLegalEntity RegistrationName')?.textContent || '',
        documentoCliente: xmlDoc.querySelector('AccountingCustomerParty PartyIdentification ID')?.textContent || 'No especificado',
        total: legalTotal?.querySelector('PayableAmount')?.textContent || '0.00',
        moneda: xmlDoc.querySelector('DocumentCurrencyCode')?.textContent || 'PEN',
        montoLetras: xmlDoc.querySelector('Note')?.textContent || '',
        tipoComprobante: 'BOLETA ELECTRÓNICA',
        tipoDocumentoCliente: 'DNI',
        numeroDocumentoCliente: '',
        items: [],
        impuestos: {
          gravada: '0.00',
          exonerada: '0.00',
          inafecta: '0.00',
          isc: '0.00',
          igv: '0.00',
          otrosCargos: formatCurrency(legalTotal?.querySelector('ChargeTotalAmount')?.textContent || '0.00'),
          otrosTributos: '0.00',
          redondeo: formatCurrency(legalTotal?.querySelector('PayableRoundingAmount')?.textContent || '0.00')
        }
      };

      // Parse address
      const direccionEmisor = xmlDoc.querySelector('AccountingSupplierParty PartyLegalEntity RegistrationAddress');
      if (direccionEmisor) {
        const urbanizacion = direccionEmisor.querySelector('CitySubdivisionName')?.textContent || '';
        const direccionLinea = direccionEmisor.querySelector('AddressLine Line')?.textContent || '';
        const distrito = direccionEmisor.querySelector('District')?.textContent || '';
        const provincia = direccionEmisor.querySelector('CountrySubentity')?.textContent || '';
        newBoletaData.direccionCompleta = `${direccionLinea} ${urbanizacion} ${distrito} ${provincia}`.trim();
      }

      // Parse client document type
      const clienteIDNode = xmlDoc.getElementsByTagName('cac:AccountingCustomerParty')[0]
        ?.getElementsByTagName('cac:PartyIdentification')[0]
        ?.getElementsByTagName('cbc:ID')[0];

      if (clienteIDNode) {
        const scheme = clienteIDNode.getAttribute('schemeID');
        newBoletaData.numeroDocumentoCliente = clienteIDNode.textContent || '';

        switch (scheme) {
          case '1': newBoletaData.tipoDocumentoCliente = 'DNI'; break;
          case '6': newBoletaData.tipoDocumentoCliente = 'RUC'; break;
          case '4': newBoletaData.tipoDocumentoCliente = 'Carnet Extranjería'; break;
          case '7': newBoletaData.tipoDocumentoCliente = 'Pasaporte'; break;
          default: newBoletaData.tipoDocumentoCliente = 'Sin Documento'; break;
        }
      }

      // Parse items
      const itemNodes = xmlDoc.querySelectorAll('InvoiceLine');
      for (let item of itemNodes) {
        newBoletaData.items.push({
          descripcion: item.querySelector('Description')?.textContent || '',
          cantidad: formatCurrency(item.querySelector('InvoicedQuantity')?.textContent || '0'),
          unidad: item.querySelector('InvoicedQuantity')?.getAttribute('unitCode') || 'NIU',
          precio: formatCurrency(item.querySelector('PriceAmount')?.textContent || '0'),
          total: formatCurrency(item.querySelector('LineExtensionAmount')?.textContent || '0')
        });
      }

      // Parse taxes
      xmlDoc.querySelectorAll('TaxSubtotal').forEach(tax => {
        const codigo = tax.querySelector('TaxScheme ID')?.textContent;
        const monto = tax.querySelector('TaxAmount')?.textContent || '0.00';
        const base = tax.querySelector('TaxableAmount')?.textContent || '0.00';
        const exoneracion = tax.querySelector('TaxExemptionReasonCode')?.textContent;

        if (codigo === '1000') newBoletaData.impuestos.igv = formatCurrency(monto);
        if (codigo === '2000') newBoletaData.impuestos.isc = formatCurrency(monto);
        if (exoneracion === '10') newBoletaData.impuestos.exonerada = formatCurrency(base);
        if (exoneracion === '20') newBoletaData.impuestos.inafecta = formatCurrency(base);
        if (exoneracion === '30') newBoletaData.impuestos.gravada = formatCurrency(base);
      });

      // Generate QR code
      const qrURL = `https://e-consulta.sunat.gob.pe/ol-ti-itconsvalicpe/ConsValiCpe.htm?ruc=${newBoletaData.rucEmisor}&num=${newBoletaData.numeroBoleta}&fec=${formatDate(newBoletaData.issueDate)}&tot=${newBoletaData.total}`;
      const qrBase64 = await generateQRCode(qrURL);
      setQrCodeBase64(qrBase64);

      setBoletaData(newBoletaData);
    } catch (error) {
      console.error('Error parsing XML:', error);
      alert('Error al procesar el XML');
    }
  };

  const generatePDF = () => {
    if (!boletaData) return;

    const pdf = new jsPDF('p', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    let yPosition = 20;

    // Header section with logo and company info
    const headerStartY = yPosition;
    
    // Add logo if available
    if (logoBase64) {
      try {
        const imgFormat = getImageFormat(logoBase64);
        pdf.addImage(logoBase64, imgFormat, 15, yPosition, 30, 20);
      } catch (error) {
        console.error('Error adding logo to PDF:', error);
      }
    }

    // Company info (next to logo)
    const companyInfoX = logoBase64 ? 50 : 15;
    pdf.setFontSize(14);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(0, 0, 0);
    pdf.text(boletaData.nombreLegalEmisor, companyInfoX, yPosition + 5);
    
    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'normal');
    pdf.text(boletaData.nombreEmisor, companyInfoX, yPosition + 10);
    
    if (boletaData.direccionCompleta) {
      pdf.text(boletaData.direccionCompleta, companyInfoX, yPosition + 15);
    }

    // Custom data with icons
    let customDataY = yPosition + (boletaData.direccionCompleta ? 20 : 15);
    customData.forEach(item => {
      pdf.setFontSize(9);
      const iconSymbol = getIconSymbol(item.iconClass);
      pdf.text(`${iconSymbol} ${item.text}`, companyInfoX, customDataY);
      customDataY += 4;
    });

    // Document info box (right side)
    const boxX = pageWidth - 65;
    const boxY = headerStartY;
    const boxWidth = 50;
    const boxHeight = 30;

    pdf.setDrawColor(76, 175, 80);
    pdf.setFillColor(232, 245, 233);
    pdf.roundedRect(boxX, boxY, boxWidth, boxHeight, 2, 2, 'FD');

    pdf.setFontSize(10);
    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(46, 125, 50);
    const titleLines = pdf.splitTextToSize(boletaData.tipoComprobante, boxWidth - 4);
    pdf.text(titleLines, boxX + boxWidth/2, boxY + 6, { align: 'center' });

    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(0, 0, 0);
    pdf.text(`RUC: ${boletaData.rucEmisor}`, boxX + boxWidth/2, boxY + 15, { align: 'center' });
    pdf.text(`N°: ${boletaData.numeroBoleta}`, boxX + boxWidth/2, boxY + 22, { align: 'center' });

    yPosition = Math.max(customDataY + 5, boxY + boxHeight + 10);

    // Customer info section
    pdf.setFillColor(249, 249, 249);
    pdf.rect(15, yPosition, pageWidth - 30, 20, 'F');
    
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Fecha: ${formatDate(boletaData.issueDate)}`, 20, yPosition + 5);
    pdf.text(`Cliente: ${boletaData.cliente}`, 20, yPosition + 10);
    pdf.text(`${boletaData.tipoDocumentoCliente}: ${boletaData.numeroDocumentoCliente}`, 20, yPosition + 15);
    pdf.text(`Moneda: ${boletaData.moneda === 'PEN' ? 'Soles' : boletaData.moneda}`, 120, yPosition + 5);
    yPosition += 25;

    // Items table
    const colWidths = [20, 25, 85, 25, 25];
    const colX = [15, 35, 60, 145, 170];

    // Table header
    pdf.setFillColor(76, 175, 80);
    pdf.rect(15, yPosition, pageWidth - 30, 8, 'F');
    
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(8);
    pdf.setFont('helvetica', 'bold');
    pdf.text('Cant.', colX[0] + 2, yPosition + 5);
    pdf.text('Unidad', colX[1] + 2, yPosition + 5);
    pdf.text('Descripción', colX[2] + 2, yPosition + 5);
    pdf.text('Valor Unit. (*)', colX[3] + 2, yPosition + 5);
    pdf.text('Importe (**)', colX[4] + 2, yPosition + 5);
    yPosition += 8;

    // Table rows
    pdf.setTextColor(0, 0, 0);
    pdf.setFont('helvetica', 'normal');
    boletaData.items.forEach((item) => {
      if (yPosition > 250) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.text(item.cantidad, colX[0] + 2, yPosition + 5);
      pdf.text(item.unidad, colX[1] + 2, yPosition + 5);
      
      // Handle long descriptions
      const descLines = pdf.splitTextToSize(item.descripcion, colWidths[2] - 4);
      pdf.text(descLines, colX[2] + 2, yPosition + 5);
      
      pdf.text(item.precio, colX[3] + 2, yPosition + 5);
      pdf.text(item.total, colX[4] + 2, yPosition + 5);
      
      const lineHeight = Math.max(6, descLines.length * 4);
      
      // Row border
      pdf.setDrawColor(238, 238, 238);
      pdf.line(15, yPosition + lineHeight, pageWidth - 15, yPosition + lineHeight);
      
      yPosition += lineHeight;
    });

    yPosition += 5;

    // Note about values
    pdf.setFontSize(7);
    pdf.setTextColor(102, 102, 102);
    pdf.text('(*) Sin impuestos. (**) Incluye impuestos, de ser Op. Gravada.', 15, yPosition);
    yPosition += 8;

    // Totals section
    const totalsX = pageWidth - 80;
    pdf.setFontSize(9);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`Op. Gravada: S/ ${boletaData.impuestos.gravada}`, totalsX, yPosition);
    yPosition += 4;
    pdf.text(`Op. Exonerada: S/ ${boletaData.impuestos.exonerada}`, totalsX, yPosition);
    yPosition += 4;
    pdf.text(`Op. Inafecta: S/ ${boletaData.impuestos.inafecta}`, totalsX, yPosition);
    yPosition += 4;
    pdf.text(`ISC: S/ ${boletaData.impuestos.isc}`, totalsX, yPosition);
    yPosition += 4;
    pdf.text(`IGV: S/ ${boletaData.impuestos.igv}`, totalsX, yPosition);
    yPosition += 4;
    pdf.text(`Otros Cargos: S/ ${boletaData.impuestos.otrosCargos}`, totalsX, yPosition);
    yPosition += 4;
    pdf.text(`Otros Tributos: S/ ${boletaData.impuestos.otrosTributos}`, totalsX, yPosition);
    yPosition += 4;
    pdf.text(`Monto de Redondeo: S/ ${boletaData.impuestos.redondeo}`, totalsX, yPosition);
    yPosition += 6;

    pdf.setFont('helvetica', 'bold');
    pdf.text(`Importe Total: S/ ${formatCurrency(boletaData.total)}`, totalsX, yPosition);
    yPosition += 10;

    // Amount in words
    if (boletaData.montoLetras) {
      pdf.setFont('helvetica', 'italic');
      pdf.setFontSize(8);
      const wordsLines = pdf.splitTextToSize(boletaData.montoLetras, pageWidth - 30);
      pdf.text(wordsLines, 15, yPosition);
      yPosition += wordsLines.length * 4 + 10;
    }

    // QR Code (if available)
    if (qrCodeBase64) {
      try {
        pdf.addImage(qrCodeBase64, 'PNG', pageWidth/2 - 15, yPosition, 30, 30);
        yPosition += 35;
        pdf.setFontSize(8);
        pdf.setFont('helvetica', 'normal');
        pdf.text('Escanee para validar en SUNAT', pageWidth/2, yPosition, { align: 'center' });
        yPosition += 10;
      } catch (error) {
        console.error('Error adding QR code to PDF:', error);
      }
    }

    // Footer
    pdf.setFontSize(7);
    pdf.setTextColor(102, 102, 102);
    pdf.text('Representación impresa de la Boleta Electrónica - Consulte en https://e-consulta.sunat.gob.pe', 
             pageWidth/2, yPosition, { align: 'center' });

    pdf.save(`boleta_${boletaData.numeroBoleta}.pdf`);
  };

  const getIconComponent = (iconClass: string) => {
    const iconMap: { [key: string]: React.ElementType } = {
      mail: Mail,
      phone: Phone,
      whatsapp: MessageCircle,
      globe: Globe,
      facebook: Facebook
    };
    return iconMap[iconClass] || Mail;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <FileText className="w-8 h-8 text-green-600" />
            Lector de Boletas SUNAT
          </h1>
          <p className="text-gray-600 mt-2">Procesa archivos XML de SUNAT y genera PDFs profesionales</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <div className="lg:col-span-1 space-y-6">
            {/* XML Upload */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Upload className="w-5 h-5" />
                1. Subir XML
              </h2>
              <div className="space-y-3">
                <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-green-300 rounded-lg cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                  <div className="text-center">
                    <Upload className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <span className="text-sm text-gray-600">Seleccionar archivo XML</span>
                  </div>
                  <input
                    type="file"
                    accept=".xml"
                    onChange={handleXMLUpload}
                    className="hidden"
                  />
                </label>
                {fileName && (
                  <p className="text-sm text-green-600 font-medium">{fileName}</p>
                )}
              </div>
            </div>

            {/* Logo Upload */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Image className="w-5 h-5" />
                2. Logo Personalizado
              </h2>
              <div className="space-y-3">
                <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-blue-300 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                  <div className="text-center">
                    {logoBase64 ? (
                      <img src={logoBase64} alt="Logo" className="max-w-full max-h-20 mx-auto mb-2" />
                    ) : (
                      <>
                        <Image className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                        <span className="text-sm text-gray-600">Arrastra tu logo aquí</span>
                      </>
                    )}
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                    className="hidden"
                  />
                </label>
                {logoBase64 && (
                  <button
                    onClick={clearLogo}
                    className="w-full bg-red-500 text-white py-2 px-4 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Eliminar Logo
                  </button>
                )}
              </div>
            </div>

            {/* Custom Data */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">3. Datos Personalizados</h2>
              
              {/* Custom Data List */}
              <div ref={customDataRef} className="space-y-2 mb-4">
                {customData.map((item, index) => {
                  const IconComponent = getIconComponent(item.iconClass);
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border"
                    >
                      <GripVertical className="w-4 h-4 text-gray-400 drag-handle cursor-grab" />
                      <IconComponent className="w-4 h-4 text-gray-600" />
                      <span className="flex-1 text-sm">{item.text}</span>
                      <button
                        onClick={() => removeCustomData(index)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Add New Data */}
              <div className="space-y-3">
                <div className="flex gap-2 flex-wrap">
                  {iconOptions.map((option) => {
                    const IconComponent = option.icon;
                    return (
                      <button
                        key={option.class}
                        onClick={() => setSelectedIcon(option.class)}
                        className={`p-2 rounded-lg border flex items-center justify-center ${
                          selectedIcon === option.class
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                        }`}
                        title={option.label}
                      >
                        <IconComponent className="w-4 h-4" />
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  value={customText}
                  onChange={(e) => setCustomText(e.target.value)}
                  placeholder="Escribe aquí..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  onKeyPress={(e) => e.key === 'Enter' && addCustomData()}
                />
                <button
                  onClick={addCustomData}
                  className="w-full bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                  disabled={!customText.trim()}
                >
                  Agregar Dato
                </button>
              </div>
            </div>

            {/* Generate PDF */}
            {boletaData && (
              <button
                onClick={generatePDF}
                className="w-full bg-green-600 text-white py-3 px-4 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center gap-2 font-semibold"
              >
                <Download className="w-5 h-5" />
                Generar PDF
              </button>
            )}
          </div>

          {/* Preview Section */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Vista Previa</h2>
              <div className="bg-white border rounded-lg overflow-auto" style={{ maxHeight: '800px' }}>
                {boletaData ? (
                  <div className="p-6 text-xs leading-tight max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-4 pb-4 border-b-2 border-green-500">
                      <div className="flex items-start gap-4">
                        {logoBase64 && (
                          <img src={logoBase64} alt="Logo" className="max-w-24 max-h-16" />
                        )}
                        <div>
                          <h3 className="font-bold text-sm">{boletaData.nombreLegalEmisor}</h3>
                          <p className="text-xs">{boletaData.nombreEmisor}</p>
                          {boletaData.direccionCompleta && (
                            <p className="text-xs">{boletaData.direccionCompleta}</p>
                          )}
                          {customData.map((item, index) => {
                            const IconComponent = getIconComponent(item.iconClass);
                            return (
                              <p key={index} className="text-xs flex items-center gap-1">
                                <IconComponent className="w-3 h-3" />
                                {item.text}
                              </p>
                            );
                          })}
                        </div>
                      </div>
                      <div className="bg-green-50 border-2 border-green-500 rounded-lg p-3 text-center">
                        <div className="font-bold text-sm text-green-700">{boletaData.tipoComprobante}</div>
                        <div className="text-xs mt-1">RUC: {boletaData.rucEmisor}</div>
                        <div className="text-xs">N°: {boletaData.numeroBoleta}</div>
                      </div>
                    </div>

                    {/* Customer Info */}
                    <div className="bg-gray-50 rounded p-3 mb-4 text-xs">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <strong>Fecha:</strong> {formatDate(boletaData.issueDate)}
                        </div>
                        <div>
                          <strong>Cliente:</strong> {boletaData.cliente}
                        </div>
                        <div>
                          <strong>{boletaData.tipoDocumentoCliente}:</strong> {boletaData.numeroDocumentoCliente}
                        </div>
                        <div>
                          <strong>Moneda:</strong> {boletaData.moneda === 'PEN' ? 'Soles' : boletaData.moneda}
                        </div>
                      </div>
                    </div>

                    {/* Items Table */}
                    <table className="w-full border-collapse mb-4 text-xs">
                      <thead>
                        <tr className="bg-green-500 text-white">
                          <th className="border p-2 text-left">Cant.</th>
                          <th className="border p-2 text-left">Unidad</th>
                          <th className="border p-2 text-left">Descripción</th>
                          <th className="border p-2 text-left">Valor Unit. (*)</th>
                          <th className="border p-2 text-left">Importe de Venta (**)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {boletaData.items.map((item, index) => (
                          <tr key={index}>
                            <td className="border p-2">{item.cantidad}</td>
                            <td className="border p-2">{item.unidad}</td>
                            <td className="border p-2">{item.descripcion}</td>
                            <td className="border p-2">{item.precio}</td>
                            <td className="border p-2">{item.total}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Note */}
                    <div className="text-xs text-gray-600 mb-4">
                      (*) Sin impuestos. (**) Incluye impuestos, de ser Op. Gravada.
                    </div>

                    {/* Totals */}
                    <div className="text-right mb-4 text-xs space-y-1">
                      <div>Op. Gravada: S/ {boletaData.impuestos.gravada}</div>
                      <div>Op. Exonerada: S/ {boletaData.impuestos.exonerada}</div>
                      <div>Op. Inafecta: S/ {boletaData.impuestos.inafecta}</div>
                      <div>ISC: S/ {boletaData.impuestos.isc}</div>
                      <div>IGV: S/ {boletaData.impuestos.igv}</div>
                      <div>Otros Cargos: S/ {boletaData.impuestos.otrosCargos}</div>
                      <div>Otros Tributos: S/ {boletaData.impuestos.otrosTributos}</div>
                      <div>Monto de Redondeo: S/ {boletaData.impuestos.redondeo}</div>
                      <div className="font-bold text-sm border-t pt-2">
                        Importe Total: S/ {formatCurrency(boletaData.total)}
                      </div>
                    </div>

                    {/* Amount in Words */}
                    {boletaData.montoLetras && (
                      <div className="italic text-xs p-2 border-t border-b border-dashed mb-4">
                        {boletaData.montoLetras}
                      </div>
                    )}

                    {/* QR Code */}
                    {qrCodeBase64 && (
                      <div className="text-center mb-4">
                        <img src={qrCodeBase64} alt="QR SUNAT" className="mx-auto mb-2" />
                        <p className="text-xs">Escanee para validar en SUNAT</p>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="text-center text-xs text-gray-500 border-t pt-2">
                      Representación impresa de la Boleta Electrónica - Consulte en https://e-consulta.sunat.gob.pe
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <p>Suba un archivo XML para previsualizar la boleta</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;