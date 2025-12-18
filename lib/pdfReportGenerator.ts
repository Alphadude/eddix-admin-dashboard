import jsPDF from "jspdf"
import autoTable from "jspdf-autotable"
import html2canvas from "html2canvas"

interface ReportData {
    year: number
    totalRevenue: number
    activeUsers: number
    feesEarned: number
    withdrawalRate: number
    contributionGrowth: Array<{ month: string; amount: number }>
    withdrawalFrequency: Array<{ month: string; amount: number }>
    userEngagement: { weekly: number; biweekly: number; monthly: number }
    feesEarnedByMonth: Array<{ month: string; amount: number }>
}

// Color palette for the PDF
const COLORS = {
    primary: "#3b82f6", // Blue
    secondary: "#8b5cf6", // Purple
    success: "#10b981", // Green
    warning: "#f59e0b", // Orange
    danger: "#ef4444", // Red
    dark: "#1f2937", // Dark gray
    light: "#f3f4f6", // Light gray
    text: "#374151", // Text gray
}

export const generatePDFReport = async (data: ReportData) => {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
    })

    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    let yPosition = 20

    // Helper function to format currency
    const formatCurrency = (amount: number) => {
        return `₦${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    }

    // ===== HEADER SECTION =====
    // Add colored header background
    doc.setFillColor(COLORS.primary)
    doc.rect(0, 0, pageWidth, 45, "F")

    // Add logo/title
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(24)
    doc.setFont("helvetica", "bold")
    doc.text("Eddix Savings", 15, 20)

    doc.setFontSize(16)
    doc.setFont("helvetica", "normal")
    doc.text("Analytics Report", 15, 30)

    // Add date and year
    doc.setFontSize(10)
    const currentDate = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
    })
    doc.text(`Generated: ${currentDate}`, 15, 38)
    doc.text(`Report Year: ${data.year}`, pageWidth - 50, 38)

    yPosition = 55

    // ===== KEY METRICS SECTION =====
    doc.setTextColor(COLORS.dark)
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("Key Performance Metrics", 15, yPosition)
    yPosition += 10

    // Create metrics cards
    const metrics = [
        {
            label: "Total Revenue",
            value: formatCurrency(data.totalRevenue),
            color: COLORS.primary,
            icon: "↑",
        },
        {
            label: "Active Users",
            value: data.activeUsers.toLocaleString(),
            color: COLORS.success,
            icon: "👥",
        },
        {
            label: "Fees Earned",
            value: formatCurrency(data.feesEarned),
            color: COLORS.warning,
            icon: "💰",
        },
        {
            label: "Withdrawal Rate",
            value: `${data.withdrawalRate.toFixed(1)}%`,
            color: COLORS.secondary,
            icon: "📊",
        },
    ]

    const cardWidth = 85  // Expanded card width
    const cardHeight = 25
    const cardSpacing = 8  // Increased spacing between cards
    let xPosition = 15

    metrics.forEach((metric, index) => {
        if (index === 2) {
            xPosition = 15
            yPosition += cardHeight + cardSpacing
        }

        // Draw card background
        doc.setFillColor(metric.color)
        doc.roundedRect(xPosition, yPosition, cardWidth, cardHeight, 2, 2, "F")

        // Add metric label
        doc.setTextColor(255, 255, 255)
        doc.setFontSize(9)
        doc.setFont("helvetica", "normal")
        doc.text(metric.label, xPosition + 3, yPosition + 6)

        // Add metric value
        doc.setFontSize(16)
        doc.setFont("helvetica", "bold")
        doc.text(metric.value, xPosition + 3, yPosition + 16)

        // Add icon
        doc.setFontSize(20)
        doc.text(metric.icon, xPosition + cardWidth - 10, yPosition + 18)

        xPosition += cardWidth + cardSpacing
    })

    yPosition += cardHeight + 15

    // ===== CONTRIBUTION GROWTH TABLE =====
    doc.setTextColor(COLORS.dark)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Monthly Contribution Growth", 15, yPosition)
    yPosition += 5

    const contributionData = data.contributionGrowth.map((item) => [
        item.month,
        formatCurrency(item.amount),
    ])

    autoTable(doc, {
        startY: yPosition,
        head: [["Month", "Amount"]],
        body: contributionData,
        theme: "grid",
        headStyles: {
            fillColor: COLORS.primary,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: "bold",
            cellPadding: 3,  // Added padding
        },
        bodyStyles: {
            fontSize: 9,
            textColor: COLORS.text,
            cellPadding: 3,  // Added padding
        },
        alternateRowStyles: {
            fillColor: COLORS.light,
        },
        columnStyles: {
            0: { cellWidth: 40, cellPadding: { left: 5 } },  // More left padding
            1: { cellWidth: "auto", halign: "right", cellPadding: { right: 5 } },
        },
        margin: { left: 15, right: 15 },
    })

    yPosition = (doc as any).lastAutoTable.finalY + 10

    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
        doc.addPage()
        yPosition = 20
    }

    // ===== WITHDRAWAL FREQUENCY TABLE =====
    doc.setTextColor(COLORS.dark)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Monthly Withdrawal Frequency", 15, yPosition)
    yPosition += 5

    const withdrawalData = data.withdrawalFrequency.map((item) => [
        item.month,
        formatCurrency(item.amount),
    ])

    autoTable(doc, {
        startY: yPosition,
        head: [["Month", "Amount"]],
        body: withdrawalData,
        theme: "grid",
        headStyles: {
            fillColor: COLORS.warning,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: "bold",
            cellPadding: 3,  // Added padding
        },
        bodyStyles: {
            fontSize: 9,
            textColor: COLORS.text,
            cellPadding: 3,  // Added padding
        },
        alternateRowStyles: {
            fillColor: COLORS.light,
        },
        columnStyles: {
            0: { cellWidth: 40, cellPadding: { left: 5 } },  // More left padding
            1: { cellWidth: "auto", halign: "right", cellPadding: { right: 5 } },
        },
        margin: { left: 15, right: 15 },
    })

    yPosition = (doc as any).lastAutoTable.finalY + 10

    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
        doc.addPage()
        yPosition = 20
    }

    // ===== USER ENGAGEMENT SECTION =====
    doc.setTextColor(COLORS.dark)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("User Engagement", 15, yPosition)
    yPosition += 5

    const engagementData = [
        ["Weekly Contributors", data.userEngagement.weekly.toString()],
        ["Bi-weekly Contributors", data.userEngagement.biweekly.toString()],
        ["Monthly Contributors", data.userEngagement.monthly.toString()],
    ]

    autoTable(doc, {
        startY: yPosition,
        head: [["Period", "Active Users"]],
        body: engagementData,
        theme: "grid",
        headStyles: {
            fillColor: COLORS.success,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: "bold",
            cellPadding: 3,  // Added padding
        },
        bodyStyles: {
            fontSize: 9,
            textColor: COLORS.text,
            cellPadding: 3,  // Added padding
        },
        alternateRowStyles: {
            fillColor: COLORS.light,
        },
        columnStyles: {
            0: { cellWidth: 80, cellPadding: { left: 5 } },  // More left padding
            1: { cellWidth: "auto", halign: "right", cellPadding: { right: 5 } },
        },
        margin: { left: 15, right: 15 },
    })

    yPosition = (doc as any).lastAutoTable.finalY + 10

    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
        doc.addPage()
        yPosition = 20
    }

    // ===== FEES EARNED BY MONTH TABLE =====
    doc.setTextColor(COLORS.dark)
    doc.setFontSize(12)
    doc.setFont("helvetica", "bold")
    doc.text("Monthly Fees Earned", 15, yPosition)
    yPosition += 5

    const feesData = data.feesEarnedByMonth.map((item) => [
        item.month,
        formatCurrency(item.amount),
    ])

    autoTable(doc, {
        startY: yPosition,
        head: [["Month", "Fees"]],
        body: feesData,
        theme: "grid",
        headStyles: {
            fillColor: COLORS.secondary,
            textColor: [255, 255, 255],
            fontSize: 10,
            fontStyle: "bold",
            cellPadding: 3,  // Added padding
        },
        bodyStyles: {
            fontSize: 9,
            textColor: COLORS.text,
            cellPadding: 3,  // Added padding
        },
        alternateRowStyles: {
            fillColor: COLORS.light,
        },
        columnStyles: {
            0: { cellWidth: 40, cellPadding: { left: 5 } },  // More left padding
            1: { cellWidth: "auto", halign: "right", cellPadding: { right: 5 } },
        },
        margin: { left: 15, right: 15 },
    })

    // ===== FOOTER =====
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i)
        doc.setFillColor(COLORS.light)
        doc.rect(0, pageHeight - 15, pageWidth, 15, "F")
        doc.setTextColor(COLORS.text)
        doc.setFontSize(8)
        doc.setFont("helvetica", "normal")
        doc.text(
            `Eddix Savings - Confidential Report`,
            15,
            pageHeight - 8
        )
        doc.text(
            `Page ${i} of ${totalPages}`,
            pageWidth - 30,
            pageHeight - 8
        )
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().split("T")[0]
    const filename = `eddix-analytics-report-${data.year}-${timestamp}.pdf`

    // Save the PDF
    doc.save(filename)
}
