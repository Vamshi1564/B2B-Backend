const express = require("express");
const router = express.Router();
const db = require("../Config/db");
const bcrypt = require("bcryptjs");



router.post("/register", (req, res) => {

  const {
    role,
    company_name,
    contact_person,
    emails,
    mobiles,
    area,
    landmark,
    city,
    state,
    pincode,
    country,
    supplier_type,
    gst_applicable,
    gst_number,
    agent_type,
    allow_duplicate
  } = req.body;

  // ================= VALIDATIONS =================

  // ✅ Agent Type Mandatory
  if (role === "agent" && !agent_type) {
    return res.status(400).json({ message: "Agent type is required" });
  }

  // ✅ Company Name Format
  if (company_name && !/^[a-zA-Z0-9\s.&-]{2,100}$/.test(company_name)) {
    return res.status(400).json({ message: "Invalid Travel Agency Name" });
  }

  // ✅ Individual Name Format
  if (contact_person && !/^[a-zA-Z\s]{2,50}$/.test(contact_person)) {
    return res.status(400).json({ message: "Invalid Individual Name" });
  }

  // ✅ Email Format
  if (emails && emails.length > 0) {
    for (let email of emails) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ message: `Invalid Email: ${email}` });
      }
    }
  }

  // ✅ Mobile Format
  if (mobiles && mobiles.length > 0) {
    for (let mobile of mobiles) {
      if (!/^[6-9]\d{9}$/.test(mobile)) {
        return res.status(400).json({ message: `Invalid Mobile: ${mobile}` });
      }
    }
  }

  // ================= MAIN FUNCTION =================

  const continueRegistration = () => {

    const cleanedEmails = (emails || []).filter(e => e.trim() !== "");
    const cleanedMobiles = (mobiles || []).filter(m => m.trim() !== "");

    // ================= EMAIL DUPLICATE CHECK =================

    const checkEmailSql = `SELECT company_name, email FROM users WHERE email IS NOT NULL`;

    db.query(checkEmailSql, (err, rows) => {

      if (err) {
        console.error(err);
        return res.status(400).json({ message: "Error checking emails" });
      }

      for (let user of rows) {
        const existingEmails = user.email
          ? user.email.split(",").map(e => e.trim())
          : [];

        for (let newEmail of cleanedEmails) {
          if (existingEmails.includes(newEmail) && user.company_name === company_name) {
            return res.status(400).json({
              message: "Email already exists for this company"
            });
          }
        }
      }

      // ================= MOBILE DUPLICATE CHECK =================

      const checkMobileSql = `SELECT company_name, mobile FROM users WHERE mobile IS NOT NULL`;

      db.query(checkMobileSql, (err, rows) => {

        if (err) {
          console.error(err);
          return res.status(400).json({ message: "Error checking mobile numbers" });
        }

        for (let user of rows) {
          const existingMobiles = user.mobile
            ? user.mobile.split(",").map(m => m.trim())
            : [];

          for (let newMobile of cleanedMobiles) {
            if (existingMobiles.includes(newMobile) && user.company_name === company_name) {
              return res.status(400).json({
                message: "Mobile already exists for this company"
              });
            }
          }
        }

        // ================= INSERT =================

        const insertUser = (agentCode = null) => {

          const sql = `
            INSERT INTO users
            (role, agent_type, agent_code, supplier_type,
             company_name, contact_person, email, mobile,
             area, landmark, city, state, pincode, country,
             gst_applicable, gst_number,
             status, registration_type, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'self', 0)
          `;

          const values = [
            role,
            agent_type || null,
            agentCode,
            supplier_type || null,
            company_name,
            contact_person,
            cleanedEmails.join(","),
            cleanedMobiles.join(","),
            area || null,
            landmark || null,
            city || null,
            state || null,
            pincode || null,
            country || null,
            gst_applicable || "no",
            gst_number || null
          ];

          db.query(sql, values, (err) => {

            if (err) {
              console.error("Insert Error:", err);

              let message = "Failed to register";

              if (err.code === "ER_BAD_NULL_ERROR") {
                const match = err.sqlMessage.match(/Column '(.+?)'/);
                const field = match ? match[1] : "Field";
                message = `${field.replace("_", " ")} is required`;
              }

              if (err.code === "ER_DUP_ENTRY") {
                const match = err.sqlMessage.match(/for key '(.+?)'/);
                const field = match ? match[1] : "Field";
                message = `${field} already exists`;
              }

              return res.status(400).json({ message });
            }

            return res.json({
              message: "Registration submitted for admin approval"
            });

          });
        };

        // ================= AGENT CODE =================

        if (role === "agent") {

          const prefix = agent_type === "Domestic" ? "DOMA" : "INTA";

          const codeSql = `
            SELECT agent_code FROM users
            WHERE agent_code LIKE ?
            ORDER BY id DESC
            LIMIT 1
          `;

          db.query(codeSql, [`${prefix}%`], (err, rows) => {

            if (err) {
              console.error(err);
              return res.status(400).json({ message: "Error generating agent code" });
            }

            let nextNumber = 1;

            if (rows.length > 0) {
              const lastCode = rows[0].agent_code;
              const numberPart = parseInt(lastCode.replace(prefix, ""));
              nextNumber = numberPart + 1;
            }

            const newCode = prefix + String(nextNumber).padStart(6, "0");

            insertUser(newCode);

          });

        } else {
          insertUser();
        }

      });

    });

  };

  // ================= COMPANY DUPLICATE =================

  if (role === "supplier") {

    const checkNameSql = `SELECT id FROM users WHERE company_name = ?`;

    db.query(checkNameSql, [company_name], (err, existing) => {

      if (err) {
        console.error(err);
        return res.status(400).json({ message: "Error checking company name" });
      }

      if (existing.length > 0 && !allow_duplicate) {
        return res.status(409).json({
          duplicate: true,
          message: "Company already exists. Continue?"
        });
      }

      continueRegistration();

    });

  } else {
    continueRegistration();
  }

});

// ================= LOGIN =================
router.post("/login", (req, res) => {

  const { email, password, role } = req.body;

  db.query(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [email],
    async (err, results) => {

      if (err) return res.status(500).json({ message: "Database error" });

      if (!results.length) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      const user = results[0];

      if (user.role !== role) {
        return res.status(403).json({
          message: `Registered as ${user.role}. Please login as ${user.role}.`
        });
      }

      if (user.status !== "approved") {
        return res.status(403).json({
          message: "Account pending admin approval"
        });
      }

      // if (user.is_active === 0) {
      //   return res.status(403).json({
      //     message: "Your account has been deactivated by B2B Partners"
      //   });
      // }

      // FIRST LOGIN
      if (user.admin_password && user.admin_password.trim() !== "") {

        if (password !== user.admin_password) {
          return res.status(400).json({ message: "Invalid credentials" });
        }

        return res.json({
          firstLogin: true,
          message: "Please change your password"
        });

      }

      // NORMAL LOGIN
      const isMatch = await bcrypt.compare(password, user.password);

      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      res.json({
        message: "Login successful",
        user: {
          id: user.id,
          role: user.role,
          company_name: user.company_name,
          is_active: user.is_active
        }
      });

    }
  );

});




router.post("/admin-login", (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password required" });
  }

  db.query(
    "SELECT * FROM users WHERE email = ? AND role = 'admin' LIMIT 1",
    [email],
    (err, rows) => {
      if (err) return res.status(500).json(err);

      if (!rows.length) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const admin = rows[0];

      // ✅ Compare with admin_password (plain text)
      if (password !== admin.admin_password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      delete admin.password;
      delete admin.admin_password;

      res.json({
        message: "Login successful",
        admin,
      });
    }
  );
});

// ================= GET CATEGORIES =================
router.get("/categories", (req, res) => {
  const sql = "SELECT id, category_name FROM categories";

  db.query(sql, (err, results) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }

    res.json(results);
  });
});



// ================= GET AGENT COUNT AND SUPPLIER COUNT =================
router.get("/count", (req, res) => {
  const sql = `
    SELECT 
      COUNT(CASE WHEN role = 'agent' THEN 1 END) AS total_agents,
      COUNT(CASE WHEN role = 'supplier' THEN 1 END) AS total_suppliers
    FROM users
  `;

  db.query(sql, (err, result) => {
    if (err) {
      return res.status(500).json({ message: "Database error" });
    }

    res.json(result[0]);
  });
});

module.exports = router;