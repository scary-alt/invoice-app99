const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const qrcode = require("qrcode");
const QRCode = require("qrcode");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const productsPath = "./data/products.json";
const staffPath = "./data/staff.json";
const invoicesPath = "./data/invoices.json";
const app = express();


let latestQR = "";

app.use(cors());
app.use(bodyParser.json({ limit: "50mb" }));
app.use(express.static(__dirname));

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "index.html"));
});
// =========================
// USERS DATA
// =========================

const managerUser = {
    username: "manager",
    password: "123456",
    role: "manager",
    name: "Manager"
};



// =========================
// JSON DATABASE
// =========================

function readJSON(file) {

    return JSON.parse(
        fs.readFileSync(
            path.join(__dirname, "data", file),
            "utf8"
        )
    );

}

function writeJSON(file, data) {

    fs.writeFileSync(
        path.join(__dirname, "data", file),
        JSON.stringify(data, null, 2)
    );

}

let managerProducts = readJSON("products.json");

let staffUsers = readJSON("staff.json");

let invoicesHistory = readJSON("invoices.json");

// =========================
// WHATSAPP
// =========================

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    }
});






client.on("qr", async (qr) => {
    latestQR = await QRCode.toDataURL(qr);
    console.log("SCAN QR");
});

app.get("/qr", (req, res) => {

    if (!latestQR) {
        return res.send("QR not generated yet");
    }

    res.send(`
        <html>
            <body style="display:flex;justify-content:center;align-items:center;height:100vh;background:#111;">
                <img src="${latestQR}" />
            </body>
        </html>
    `);
});
client.on("ready", () => {
    console.log("✅ WHATSAPP READY");
});

client.initialize();

// ================================
// WHATSAPP
// ================================




// =========================
// AUTH
// =========================

app.post("/auth/login", (req, res) => {

    const { username, password } = req.body;

    if (
        username === managerUser.username &&
        password === managerUser.password
    ) {

        res.json({
            success: true,
            user: managerUser,
            role: "manager"
        });

    } else {

        const staff = staffUsers.find(
            s =>
                s.username === username &&
                s.password === password
        );

        if (staff) {

            res.json({
                success: true,
                user: staff,
                role: "staff"
            });

        } else {

            res.json({
                success: false
            });

        }
    }
});

// =========================
// MANAGER ROUTES
// =========================

app.get("/manager/products", (req, res) => {
    res.json(managerProducts);
});

app.post("/manager/products", (req, res) => {

    const newProduct = {
        id: Date.now(),
        ...req.body
    };

    managerProducts.push(newProduct);
    writeJSON("products.json", managerProducts);

    res.json({
        success: true
    });
});

app.delete("/manager/products/:id", (req, res) => {

    managerProducts = managerProducts.filter(
       
        p => p.id != req.params.id
    );
 writeJSON("products.json", managerProducts);
    res.json({
        success: true
    });
});

// =========================
// STAFF ROUTES
// =========================

app.get("/manager/staff", (req, res) => {
    res.json(staffUsers);
});

app.post("/manager/staff", (req, res) => {

    const newStaff = {
        id: Date.now(),
        ...req.body,
        role: "staff"
    };

    staffUsers.push(newStaff);
writeJSON("staff.json", staffUsers);
    console.log("👤 Created staff:", newStaff.username);

    res.json({
        success: true
    });
});

app.delete("/manager/staff/:username", (req, res) => {

    staffUsers = staffUsers.filter(
        s => s.username != req.params.username
    );
writeJSON("staff.json", staffUsers);
    res.json({
        success: true
    });
});

// =========================
// INVOICE HISTORY
// =========================

app.get("/manager/invoices", (req, res) => {
    res.json(invoicesHistory);
});

// =========================
// SEND INVOICE
// =========================

app.post("/send", async (req, res) => {

    try {

        const data = req.body;

        let cleanPhone = data.phone.replace(/\D/g, "");

if (cleanPhone.startsWith("91")) {
    cleanPhone = cleanPhone.slice(2);
}

const phone = "91" + cleanPhone + "@c.us";

console.log("Sending to:", phone);

        // SAVE HISTORY
        invoicesHistory.unshift({
            ...data,
            timestamp: new Date()
        });
writeJSON("invoices.json", invoicesHistory);
        if (invoicesHistory.length > 1000) {
            invoicesHistory.pop();
        }

        // =========================
        // PDF SETUP
        // =========================

        const fileName = `invoice_${data.invoiceNo}.pdf`;

        const invoicesDir = path.join(__dirname, "invoices");

        // CREATE FOLDER IF NOT EXISTS
        if (!fs.existsSync(invoicesDir)) {
            fs.mkdirSync(invoicesDir);
        }

        const filePath = path.join(invoicesDir, fileName);

        const doc = new PDFDocument({
            size: "A4",
            margin: 20
        });

        const stream = fs.createWriteStream(filePath);

        doc.pipe(stream);

        // =========================
        // PDF CONTENT
        // =========================

        doc.fontSize(22)
            .font("Helvetica-Bold")
            .text("TAX INVOICE", {
                align: "center"
            });

        let startY = 70;

        doc.rect(20, startY, 555, 190).stroke();

        doc.moveTo(297, startY)
            .lineTo(297, startY + 190)
            .stroke();

        // LEFT SIDE

        doc.fontSize(16)
            .font("Helvetica-Bold")
            .text("Service Franchise Details", 30, startY + 10);

        doc.moveTo(30, startY + 35)
            .lineTo(280, startY + 35)
            .stroke();

        doc.fontSize(11)
            .font("Helvetica")
            .text("Sri Rajammatalli Services", 30, startY + 45)
            .text("36TH WARD SEEPANNAIDU PETA,", 30, startY + 65)
            .text("BYRIVANI PETA,", 30, startY + 82)
            .text("SRIKAKULAM, ANDHRA PRADESH", 30, startY + 99)
            .text("PIN : 532410", 30, startY + 116)
            .text("Phone : 9440756347", 30, startY + 133)
            .text("GST No : 37CXAPP7891R2Z9", 30, startY + 150);

        // RIGHT SIDE

        doc.fontSize(16)
            .font("Helvetica-Bold")
            .text("Customer Details", 310, startY + 10);

        doc.moveTo(310, startY + 35)
            .lineTo(560, startY + 35)
            .stroke();

        doc.fontSize(11)
            .font("Helvetica")
            .text(data.customer, 310, startY + 45)
            .text(data.address, 310, startY + 70, {
                width: 230
            })
            .text("Phone : " + data.phone, 310, startY + 120)
            .text("GST No : " + data.gst, 310, startY + 145);

        // =========================
        // INVOICE HEADER
        // =========================

        let invoiceY = 275;

        doc.rect(20, invoiceY, 555, 30).stroke();

        doc.fontSize(11)
            .font("Helvetica-Bold")
            .text(
                "Invoice No : " + data.invoiceNo,
                35,
                invoiceY + 10
            )
            .text(
                "Date : " + data.date,
                420,
                invoiceY + 10
            );

        // =========================
        // TABLE
        // =========================

        let tableY = 330;

        let rowHeight = 28;

        let columns = [
            20,
            55,
            190,
            285,
            335,
            420,
            490,
            575
        ];

        doc.rect(20, tableY, 555, rowHeight).stroke();

        columns.forEach(x => {

            doc.moveTo(x, tableY)
                .lineTo(x, tableY + rowHeight)
                .stroke();

        });

        doc.fontSize(10)
            .font("Helvetica-Bold")
            .text("SN", 28, tableY + 9)
            .text("Product", 90, tableY + 9)
            .text("HSN", 215, tableY + 9)
            .text("Qty", 300, tableY + 9)
            .text("Base", 355, tableY + 9)
            .text("GST", 440, tableY + 9)
            .text("Total", 515, tableY + 9);

        let currentY = tableY + rowHeight;

        let subtotal = 0;
        let gstTotal = 0;
        let grandTotal = 0;

        data.products.forEach((p, index) => {

            let base = Number(p.baseRate) * p.qty;

            subtotal += base;
            gstTotal += Number(p.gst);
            grandTotal += Number(p.amount);

            doc.rect(20, currentY, 555, rowHeight).stroke();

            columns.forEach(x => {

                doc.moveTo(x, currentY)
                    .lineTo(x, currentY + rowHeight)
                    .stroke();

            });

            doc.fontSize(10)
                .font("Helvetica")
                .text(index + 1, 28, currentY + 9)
                .text(p.product, 65, currentY + 9, {
                    width: 110
                })
                .text("84 21 99 00", 205, currentY + 9)
                .text(p.qty, 300, currentY + 9)
                .text(p.baseRate, 350, currentY + 9)
                .text(p.gst, 440, currentY + 9)
                .text(p.amount, 510, currentY + 9);

            currentY += rowHeight;

        });

        // =========================
        // TOTAL BOX
        // =========================

        currentY += 20;

        let tx = 320;
        let ty = currentY;
        let tw = 260;
        let th = 90;

        doc.lineWidth(1);

        doc.rect(tx, ty, tw, th).stroke();

        doc.moveTo(tx, ty + 30)
            .lineTo(tx + tw, ty + 30)
            .stroke();

        doc.moveTo(tx, ty + 60)
            .lineTo(tx + tw, ty + 60)
            .stroke();

        doc.moveTo(tx + 170, ty)
            .lineTo(tx + 170, ty + th)
            .stroke();

        doc.fontSize(11)
            .font("Helvetica-Bold")
            .text("Subtotal", tx + 10, ty + 10)
            .text("GST Total", tx + 10, ty + 40)
            .text("Grand Total", tx + 10, ty + 70);

        doc.fontSize(11)
            .font("Helvetica")
            .text(subtotal.toFixed(2), tx + 190, ty + 10)
            .text(gstTotal.toFixed(2), tx + 190, ty + 40);

        doc.fontSize(13)
            .font("Helvetica-Bold")
            .text(grandTotal.toFixed(2), tx + 190, ty + 70);

        // =========================
        // FINISH PDF
        // =========================

        doc.end();

        // =========================
        // SEND WHATSAPP
        // =========================

        stream.on("finish", async () => {

            try {

                console.log("✅ PDF CREATED:", filePath);

                if (!fs.existsSync(filePath)) {

                    console.log("❌ PDF FILE NOT FOUND");

                    return;
                }

                const media = MessageMedia.fromFilePath(filePath);

                await client.sendMessage(phone, media, {
                    caption:
                        `📄 GST Invoice - ${data.customer}\n` +
                        `Sri Rajammatalli Services`
                });

                console.log(
                    `✅ Sent to ${data.phone} by ${data.staff}`
                );

                // DELETE FILE AFTER SEND

                fs.unlinkSync(filePath);

            } catch (err) {

                console.error(
                    "❌ WHATSAPP SEND ERROR:",
                    err
                );

            }

        });

        res.json({
            success: true
        });

    } catch (error) {

        console.error(error);

        res.json({
            success: false
        });

    }

});

// =========================
// START SERVER
// =========================
app.get("/qr", (req, res) => {

  if (!latestQR) {
    return res.send("QR not generated yet");
  }

  res.send(`
    <html>
      <body style="
        display:flex;
        justify-content:center;
        align-items:center;
        height:100vh;
        background:#111;
      ">
        <img src="${latestQR}" />
      </body>
    </html>
  `);
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server Running on port ${PORT}`);
}); 

