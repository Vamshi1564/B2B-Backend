
const express = require("express");
const router = express.Router();
const db = require("../Config/db");
const multer = require("multer");
const path = require("path");


// ================== MULTER CONFIG ==================
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, "uploads/");
    },
    filename: function (req, file, cb) {
        const uniqueName =
            Date.now() + "-" + Math.round(Math.random() * 1e9) +
            path.extname(file.originalname);
        cb(null, uniqueName);
    },
});

const upload = multer({ storage });
const uploadFields = upload.fields([
    { name: "images", maxCount: 20 },
    { name: "videos", maxCount: 10 },
    { name: "staffPhotos", maxCount: 20 },
    { name: "cancelledCheque", maxCount: 20 },
    { name: "certificate", maxCount: 1 },
]);


router.post("/save-draft", uploadFields, async (req, res) => {

    const {
        property_id,
        supplier_id,
        form,
        meals,
        rooms,
        staff,
        amenities,
        sightseeing,
        faqs,
        policies,
        cancellation_rules,
        checkin_data,
        bank_details,
        annual_charges,
        video_links,
        contacts,
        emails
    } = req.body;

    if (!supplier_id && !property_id) {
        return res.status(400).json({
            message: "Supplier missing"
        });
    }

    try {

        const draftData = JSON.stringify({
            form,
            meals,
            rooms,
            staff,
            amenities,
            sightseeing,
            faqs,
            policies,
            cancellation_rules,
            checkin_data,
            bank_details,
            annual_charges,
            video_links,
            contacts,
            emails
        });

        if (property_id) {

            // Existing property edit
            // Update draft data only, keep current status
            await db.promise().query(
                `UPDATE properties
         SET draft_data = ?
         WHERE id = ?
         AND supplier_id =?`,

                [draftData, property_id, supplier_id]
            );

            return res.json({
                success: true,
                message: "Draft updated",
                propertyId: property_id
            });

        } else {

            // New property
            const [result] = await db.promise().query(
                `INSERT INTO properties
                (supplier_id, status, draft_data)
        VALUES(?, ?, ?)`,
                [supplier_id, "draft", draftData]
            );

            return res.json({
                success: true,
                message: "Draft saved",
                propertyId: result.insertId
            });



        }

    } catch (err) {

        console.error(err);
        res.status(500).json({ message: "Draft save failed" });

    }

});

router.get("/get-draft/:supplierId", async (req, res) => {

    const { supplierId } = req.params;

    const [rows] = await db.promise().query(
        `
 SELECT id, draft_data
 FROM properties
 WHERE supplier_id =?
                AND status = 'draft'
 ORDER BY id DESC
 LIMIT 1
                `,
        [supplierId]
    );

    if (!rows.length) {
        return res.json(null);
    }

    const draft = JSON.parse(rows[0].draft_data || "{}");

    res.json({
        id: rows[0].id,
        ...draft
    });

});

// ================== ADD PROPERTY FULL ==================
router.post("/add-property", uploadFields, async (req, res) => {
    const property_id = req.body.property_id;
    const {
        name,
        full_overview,
        category,
        state,
        city,
        area,
        pincode,
        address,
        landmark,
        contacts,
        emails,
        total_rooms,
        hotel_remarks,
        rooms,
        policies,
        staff,
        amenities,
        sightseeing,
        faqs,
        cancellation_rules,
        checkin_data,
        bank_details,
        coverIndex,
        supplier_id,
    } = req.body;

    // if (!name || !category || !state || !city || !supplier_id) {
    //     return res.status(400).json({ message: "Property basic details missing" });
    // }

    // if (!name || !supplier_id) {
    //     return res.status(400).json({ message: "Property basic details missing" });
    // }

    // ----------- PARSE ALL JSON ONCE -----------
    let parsedForm = {};

    try {
        parsedForm = req.body.form ? JSON.parse(req.body.form) : {};
    } catch (e) {
        parsedForm = {};
    }
    let parsedRooms = [];
    let parsedPolicies = {};
    let parsedStaff = [];
    let parsedAmenities = [];
    let parsedSightseeing = [];
    let parsedFaqs = [];
    let parsedRules = [];
    let parsedCheckin = {};
    let parsedBank = [];
    let parsedCharges = {};

    try {
        parsedCharges = req.body.annual_charges
            ? JSON.parse(req.body.annual_charges)
            : {};
    } catch {
        parsedCharges = {};
    }

    const safeParse = (data, def) => {
        try {
            return typeof data === "string" ? JSON.parse(data) : data;
        } catch (e) {
            console.error("JSON ERROR DATA:", data);
            return def;
        }
    };

    const parsedContacts = parsedForm.contacts || safeParse(contacts, []);
    const parsedEmails = parsedForm.emails || safeParse(emails, []);
    const hotel_address_type = parsedForm.hotel_address_type || "";
    const hotel_address1 =
        req.body.hotel_address1 || parsedForm.hotel_address1 || "";

    const hotel_address2 =
        req.body.hotel_address2 || parsedForm.hotel_address2 || "";

    const hotel_area =
        req.body.hotel_area || parsedForm.hotel_area || "";

    const hotel_city =
        req.body.hotel_city || parsedForm.hotel_city || "";

    const hotel_state =
        req.body.hotel_state || parsedForm.hotel_state || "";

    const hotel_country =
        req.body.hotel_country || parsedForm.hotel_country || "";
    try {
        parsedRooms = rooms ? JSON.parse(rooms) : [];
        parsedPolicies = policies ? JSON.parse(policies) : {};
        parsedStaff = staff ? JSON.parse(staff) : [];
        parsedAmenities = amenities ? JSON.parse(amenities) : [];
        parsedSightseeing = sightseeing ? JSON.parse(sightseeing) : [];
        parsedFaqs = faqs ? JSON.parse(faqs) : [];
        parsedRules = cancellation_rules ? JSON.parse(cancellation_rules) : [];
        parsedCheckin = checkin_data ? JSON.parse(checkin_data) : {};
        parsedBank = bank_details ? JSON.parse(bank_details) : [];
    } catch (err) {

        console.log("JSON PARSE ERROR");
        console.log(err);

        console.log("rooms =", rooms);
        console.log("staff =", staff);
        console.log("amenities =", amenities);
        console.log("bank_details =", bank_details);
        console.log("checkin_data =", checkin_data);

        return res.status(400).json({
            message: "Invalid JSON format"
        });
    }

    // ================= DUPLICATE VALIDATION =================

    const checkName =
        (name || parsedForm.name || "")
            .trim()
            .toLowerCase();

    const checkCity =
        (city || parsedForm.city || "")
            .trim()
            .toLowerCase();

    const checkArea =
        (area || parsedForm.area || "")
            .trim()
            .toLowerCase();



    let duplicateQuery = `
SELECT id
FROM properties
WHERE LOWER(TRIM(name)) = ?
                AND LOWER(TRIM(city)) = ?
                    AND LOWER(TRIM(area)) = ?
                      AND status NOT IN ('Deleted','draft')
                            `;

    const duplicateParams = [
        checkName,
        checkCity,
        checkArea
    ];

    // EDIT MODE → exclude current property
    if (property_id) {

        duplicateQuery += ` AND id != ? `;

        duplicateParams.push(property_id);

    }

    const [duplicateProperty] =
        await db.promise().query(
            duplicateQuery,
            duplicateParams
        );

    if (duplicateProperty.length) {

        return res.status(400).json({
            success: false,
            message:
                "Property already exists in the same city and area"
        });

    }

    const connection = await db.promise().getConnection();

    try {
        await connection.beginTransaction();

        // 1️⃣ INSERT PROPERTY
        let propertyId;

        if (property_id) {

            propertyId = Number(property_id);

            const [existingProperty] = await connection.query(
                `SELECT id, status
         FROM properties
         WHERE id = ?`,
                [propertyId]
            );

            if (!existingProperty.length) {
                throw new Error(`Property not found: ${propertyId}`);
            }

            let propertyStatus = existingProperty[0].status;

            if (propertyStatus === "draft") {
                propertyStatus = "pending";
            }

            let propertyStatus =
                existingProperty[0]?.status || "pending";

            // Draft → Pending only
            if (propertyStatus === "draft") {
                propertyStatus = "pending";
            }

            const certificatePath =
                req.files?.certificate?.[0]?.filename
                    ? `uploads/${req.files.certificate[0].filename}`
                    : null;

            await connection.query(
                `UPDATE properties SET
    name =?,
                full_overview =?,
                category =?,
                state =?,
                city =?,
                area =?,
                pincode =?,
                address_type =?,
                address1 =?,
                address2 =?,
                country =?,
                landmark =?,
                contact =?,
                email =?,
                total_rooms =?,
                hotel_remarks =?,
                form_json =?,
                hotel_address_type =?,
                hotel_address1 =?,
                hotel_address2 =?,
                hotel_area =?,
                hotel_landmark =?,
                hotel_pincode =?,
                hotel_city =?,
                hotel_state =?,
                hotel_country =?,
                status=?,
                draft_data = NULL,
                registration_certificate =
                COALESCE(?, registration_certificate)
                WHERE id =? `,
                [
                    name,
                    full_overview || "",
                    category,
                    state,
                    city,
                    area || "",
                    pincode || "",




                    req.body.address_type || parsedForm.address_type || "",
                    req.body.address1 || parsedForm.address1 || "",
                    req.body.address2 || parsedForm.address2 || "",
                    req.body.country || parsedForm.country || "",

                    landmark || "",

                    JSON.stringify(parsedContacts),
                    JSON.stringify(parsedEmails),

                    Number(total_rooms) || 0,
                    hotel_remarks || "",

                    JSON.stringify(parsedForm),

                    req.body.hotel_address_type || parsedForm.hotel_address_type || "",
                    req.body.hotel_address1 || parsedForm.hotel_address1 || "",
                    req.body.hotel_address2 || parsedForm.hotel_address2 || "",
                    req.body.hotel_area || parsedForm.hotel_area || "",
                    req.body.hotel_landmark || parsedForm.hotel_landmark || "",
                    req.body.hotel_pincode || parsedForm.hotel_pincode || "",
                    req.body.hotel_city || parsedForm.hotel_city || "",
                    req.body.hotel_state || parsedForm.hotel_state || "",
                    req.body.hotel_country || parsedForm.hotel_country || "",

                    propertyStatus,
                    certificatePath,
                    propertyId

                ]
            );


            const deletedVideoIds =
                JSON.parse(req.body.deleted_video_ids || "[]");

            const deletedImageIds =
                JSON.parse(req.body.deleted_image_ids || "[]");



            if (deletedVideoIds.length) {
                await connection.query(
                    `DELETE FROM property_videos
     WHERE id IN(?)`,
                    [deletedVideoIds]
                );
            }

            if (deletedImageIds.length) {
                await connection.query(
                    `DELETE FROM property_images
     WHERE id IN(?)`,
                    [deletedImageIds]
                );
            }
            // DELETE OLD DATA
            // Delete only if user uploaded new images


            // Delete only if user uploaded new videos


            await connection.query(
                `DELETE FROM property_rooms WHERE property_id =? `,
                [propertyId]
            );

            await connection.query(
                `DELETE FROM property_staff WHERE property_id =? `,
                [propertyId]
            );

            await connection.query(
                `DELETE FROM property_amenities WHERE property_id =? `,
                [propertyId]
            );

            await connection.query(
                `DELETE FROM property_sightseeing WHERE property_id =? `,
                [propertyId]
            );

            await connection.query(
                `DELETE FROM property_faqs WHERE property_id =? `,
                [propertyId]
            );

            await connection.query(
                `DELETE FROM property_checkin WHERE property_id =? `,
                [propertyId]
            );

            await connection.query(
                `DELETE FROM property_bank_details WHERE property_id =? `,
                [propertyId]
            );

            await connection.query(
                `DELETE FROM property_policies WHERE property_id =? `,
                [propertyId]
            );

            await connection.query(
                `DELETE FROM property_cancellation_rules WHERE property_id =? `,
                [propertyId]
            );

            await connection.query(
                `DELETE FROM property_annual_charges WHERE property_id =? `,
                [propertyId]
            );

            await connection.query(
                `DELETE FROM property_meals WHERE property_id =? `,
                [propertyId]
            );

        } else {

            const [propertyResult] = await connection.query(
                `INSERT INTO properties
                (name, full_overview, category, state, city, area, pincode, address_type,
                    address1,
                    address2,
                    country, landmark,
                    contact, email, supplier_id, total_rooms,
                    hotel_remarks, registration_certificate, status, form_json,
                    hotel_address_type,
                    hotel_address1,
                    hotel_address2,
                    hotel_area,
                    hotel_landmark,
                    hotel_pincode,
                    hotel_city,
                    hotel_state,
                    hotel_country)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    name,
                    full_overview || "",
                    category,
                    state,
                    city,
                    area || "",
                    pincode || "",

                    req.body.address_type || parsedForm.address_type || "",
                    req.body.address1 || parsedForm.address1 || "",
                    req.body.address2 || parsedForm.address2 || "",
                    req.body.country || parsedForm.country || "",

                    landmark || "",

                    JSON.stringify(parsedContacts),
                    JSON.stringify(parsedEmails),

                    supplier_id,
                    Number(total_rooms) || 0,
                    hotel_remarks || "",

                    req.files?.certificate?.[0]?.filename
                        ? `uploads/${req.files.certificate[0].filename}`
                        : "",

                    "pending",

                    JSON.stringify(parsedForm),

                    req.body.hotel_address_type || parsedForm.hotel_address_type || "",
                    req.body.hotel_address1 || parsedForm.hotel_address1 || "",
                    req.body.hotel_address2 || parsedForm.hotel_address2 || "",
                    req.body.hotel_area || parsedForm.hotel_area || "",
                    req.body.hotel_landmark || parsedForm.hotel_landmark || "",
                    req.body.hotel_pincode || parsedForm.hotel_pincode || "",
                    req.body.hotel_city || parsedForm.hotel_city || "",
                    req.body.hotel_state || parsedForm.hotel_state || "",
                    req.body.hotel_country || parsedForm.hotel_country || ""
                ]
            );

            propertyId = propertyResult.insertId;
        }

        // 2️⃣ INSERT IMAGES
        // Verify property exists
        const [checkProperty] = await connection.query(
            "SELECT id FROM properties WHERE id=?",
            [propertyId]
        );

        console.log("PROPERTY CHECK:", checkProperty);

        if (!checkProperty.length) {
            throw new Error("Property does not exist before image insert.");
        }

        // 2️⃣ INSERT IMAGES
        if (req.files?.images?.length) {
            const imageValues = req.files.images.map((file, index) => [
                propertyId,
                `uploads/${file.filename}`,
                index == Number(coverIndex) ? 1 : 0
            ]);

            await connection.query(
                `INSERT INTO property_images
                (property_id, image_path, is_cover)
         VALUES ? `,
                [imageValues]
            );
        }

        // 3️⃣ INSERT VIDEOS
        if (req.files?.videos?.length) {
            for (const file of req.files.videos) {
                await connection.query(
                    `INSERT INTO property_videos
                (property_id, video_path)
           VALUES(?, ?)`,
                    [propertyId, `uploads/${file.filename}`]
                );
            }
        }

        // ✅ INSERT VIDEO LINKS
        let videoLinks = [];

        try {
            videoLinks = req.body.video_links
                ? JSON.parse(req.body.video_links)
                : [];
        } catch {
            videoLinks = [];
        }

        for (const link of videoLinks) {

            const [exists] = await connection.query(
                `SELECT id
         FROM property_videos
         WHERE property_id = ?
                AND video_url = ? `,
                [propertyId, link]
            );

            if (!exists.length) {

                await connection.query(
                    `INSERT INTO property_videos
                (property_id, video_url)
             VALUES(?, ?)`,
                    [propertyId, link]
                );

            }
        }

        // 4️⃣ INSERT ROOMS & RATES
        // VALID DATES
        const validFrom = req.body.valid_from || null;
        const validTo = req.body.valid_to || null;

        for (const rateGroup of parsedRooms) {

            const rateTypeMap = {
                0: "weekday",
                1: "public_holiday",
                2: "festival",
                3: "banquet"
            };

            const rateType =
                rateTypeMap[Number(rateGroup.rate_type)];

            if (!rateType) {
                throw new Error(
                    `Invalid rate_type received: ${rateGroup.rate_type}`
                );
            }

            console.log(
                "ROOM TABLE RATE TYPE =",
                rateGroup.rate_type,
                typeof rateGroup.rate_type
            );

            for (const room of rateGroup.rooms) {
                const [roomResult] = await connection.query(
                    `INSERT INTO property_rooms
                (
                    property_id,
                    type,
                    rooms_count,
                    valid_from,
                    valid_to,
                    rate_type
                )
VALUES(?, ?, ?, ?, ?, ?)`,
                    [
                        propertyId,
                        room.type || "",
                        Number(room.rooms) || 0,
                        rateGroup.validFrom || null,
                        rateGroup.validTo || null,
                        Number(rateGroup.rate_type)
                    ]
                );

                const roomId = roomResult.insertId;

                const rateValues = [];

                const addRate = (value, plan) => {
                    // ✅ FORCE even if value is 0 or ""
                    if (value !== undefined && value !== null) {

                        rateValues.push([
                            roomId,
                            String(plan), // 🔥 FORCE STRING
                            rateType,
                            Number(value) || 0,
                            Number(room.extraAdult || 0),
                            Number(room.childBed || 0),
                            Number(room.childNoBed || 0),
                            null,
                            null
                        ]);
                    }
                };

                addRate(room.single, "EP");
                addRate(room.cpai, "CP");
                addRate(room.mapai, "MAP");
                addRate(room.apai, "AP");

                console.log("ROOM DATA =", room);
                console.log("RATE VALUES =", rateValues);
                console.log(
                    "RATE TABLE RATE TYPE =",
                    rateType
                );

                if (rateValues.length) {
                    await connection.query(
                        `INSERT INTO property_room_rates
                (room_id, plan, rate_type, base_price,
                    extra_adult_price, child_with_bed_price,
                    child_without_bed_price,
                    long_weekend_from, long_weekend_to)
VALUES ? `,
                        [rateValues]
                    );
                }
            }
        }

        // MEALS
        const parsedMeals = safeParse(req.body.meals || "{}", {});
        const mealValues = [];

        if (parsedMeals.lunchAdult) {
            mealValues.push([propertyId, null, "Extra Lunch Adult", parsedMeals.lunchAdult, 1]);
        }
        if (parsedMeals.lunchChild) {
            mealValues.push([propertyId, null, "Extra Lunch Child", parsedMeals.lunchChild, 1]);
        }
        if (parsedMeals.dinnerAdult) {
            mealValues.push([propertyId, null, "Extra Dinner Adult", parsedMeals.dinnerAdult, 1]);
        }
        if (parsedMeals.dinnerChild) {
            mealValues.push([propertyId, null, "Extra Dinner Child", parsedMeals.dinnerChild, 1]);
        }

        if (mealValues.length) {
            await connection.query(
                `INSERT INTO property_meals
                (property_id, room_id, meal_name, price, is_available)
     VALUES ? `,
                [mealValues]
            );
        }


        // 5️⃣ INSERT POLICIES
        await connection.query(
            `INSERT INTO property_policies
                (property_id, booking_policy, cancellation_policy,
                    child_policy, pet_policy, terms)
   VALUES(?, ?, ?, ?, ?, ?)`,
            [
                propertyId,
                parsedPolicies.booking_policy || "",
                parsedPolicies.cancellation_policy || "",
                parsedPolicies.child_policy || "",
                parsedPolicies.pet_policy || "",
                parsedPolicies.terms || ""
            ]
        );

        // 6️⃣ INSERT CANCELLATION RULES
        for (const rule of parsedRules) {
            await connection.query(
                `INSERT INTO property_cancellation_rules
                (property_id, from_days, to_days, charge_type, charge_value)
         VALUES(?, ?, ?, ?, ?)`,
                [
                    propertyId,
                    rule.from_days || 0,
                    rule.to_days || 0,
                    rule.charge_type || "percentage",
                    rule.charge_value || 0
                ]
            );
        }


        // 7️⃣ INSERT STAFF
        if (parsedStaff && parsedStaff.length > 0) {

            for (let i = 0; i < parsedStaff.length; i++) {

                const s = parsedStaff[i];

                console.log("STAFF DEBUG:", s); // 🔥 DEBUG

                const photoFile =
                    req.files?.staffPhotos?.[i]?.filename
                        ? `uploads/${req.files.staffPhotos[i].filename}`
                        : "";

                const fullName =
                    `${s.firstName || ""} ${s.lastName || ""}`.trim();

                const phones = [
                    s.cell1,
                    s.cell2,
                    s.landline
                ].filter(Boolean);

                const emails = [
                    s.email1,
                    s.email2
                ].filter(Boolean);

                await connection.query(
                    `INSERT INTO property_staff
                (property_id, name, designation,
                    reservation_type, city,
                    phones, mobile, alternate_mobile,
                    email, emails, photo,
                    landmark, extension,
                    is_active, show_phones, show_emails, show_photo,
                    active_fields)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        propertyId,
                        fullName,
                        s.post || "",
                        s.reservation_type || "",
                        s.city || "",
                        JSON.stringify(phones),
                        s.cell1 || "",
                        s.cell2 || "",
                        s.email1 || "",
                        JSON.stringify(emails),
                        photoFile,
                        s.landmark || "",
                        s.extension || "",
                        s.is_active ? 1 : 0, // ✅ FORCE DEFAULT ACTIVE
                        s.show_phones ? 1 : 0,
                        s.show_emails ? 1 : 0,
                        s.show_photo ? 1 : 0,
                        JSON.stringify(s.active_fields || {})
                    ]
                );
            }
        }

        // 8️⃣ INSERT AMENITIES
        for (const amenity of parsedAmenities) {
            await connection.query(
                `INSERT INTO property_amenities
                (property_id, amenity_name)
         VALUES(?, ?)`,
                [propertyId, amenity]
            );
        }

        // 9️⃣ INSERT SIGHTSEEING
        for (const place of parsedSightseeing) {
            await connection.query(
                `INSERT INTO property_sightseeing
                (property_id, place_name, distance_km,
                    travel_time, description)
         VALUES(?, ?, ?, ?, ?)`,
                [
                    propertyId,
                    place.place_name || "",
                    place.distance_km || "",
                    place.travel_time || "",
                    place.description || ""
                ]
            );
        }

        // 🔟 INSERT FAQ
        for (const faq of parsedFaqs) {

            if (!faq.question && !faq.answer) continue;

            await connection.query(
                `INSERT INTO property_faqs
                (property_id, question, answer)
     VALUES(?, ?, ?)`,
                [
                    propertyId,
                    faq.question || "",
                    faq.answer || ""
                ]
            );
        }

        // 11️⃣ INSERT CHECKIN DATA
        await connection.query(
            `INSERT INTO property_checkin
                (property_id,
                    check_in_time,
                    check_out_time,
                    is_24hr_checkin,
                    early_checkin_allowed,
                    early_checkin_charge,
                    late_checkout_allowed,
                    late_checkout_charge,
                    id_proof_required)
       VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                propertyId,
                parsedCheckin.check_in_time || "",
                parsedCheckin.check_out_time || "",
                parsedCheckin.is_24hr_checkin ? 1 : 0,
                parsedCheckin.early_checkin_allowed ? 1 : 0,
                parsedCheckin.early_checkin_charge || "",
                parsedCheckin.late_checkout_allowed ? 1 : 0,
                parsedCheckin.late_checkout_charge || "",
                parsedCheckin.id_proof_required ? 1 : 0,
            ]
        );

        // 12️⃣ INSERT BANK DETAILS
        if (parsedBank.length) {

            for (let i = 0; i < parsedBank.length; i++) {

                const bank = parsedBank[i];

                const chequeFile =
                    req.files?.cancelledCheque?.[i]?.filename
                        ? `uploads/${req.files.cancelledCheque[i].filename}`
                        : "";

                await connection.query(
                    `INSERT INTO property_bank_details
                (property_id, account_holder, bank_name,
                    account_number, ifsc, branch,
                    bank_address, address,
                    gpay_number, gpay_name,
                    cancelled_cheque)
VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        propertyId,
                        bank.account_holder || "",
                        bank.bank_name || "",
                        bank.account_number || "",
                        bank.ifsc || "",
                        bank.branch || "",
                        bank.bank_address || "",
                        bank.address || "",
                        bank.gpay_number || "",
                        bank.gpay_name || "",
                        chequeFile
                    ]
                );
            }
        }



        if (
            parsedCharges &&
            Object.values(parsedCharges).some(v => v !== "" && v !== 0)
        ) {
            await connection.query(
                `INSERT INTO property_annual_charges
                (property_id,
                    maintenance_amount, maintenance_note,
                    service_amount, service_note,
                    gst_amount, gst_note,
                    extra_amount, extra_note)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    propertyId,
                    Number(parsedCharges.maintenance_amount) || 0,
                    parsedCharges.maintenance_note || "",
                    Number(parsedCharges.service_amount) || 0,
                    parsedCharges.service_note || "",
                    Number(parsedCharges.gst_amount) || 0,
                    parsedCharges.gst_note || "",
                    Number(parsedCharges.extra_amount) || 0,
                    parsedCharges.extra_note || ""
                ]
            );
        }

        await connection.commit();
        connection.release();

        res.json({
            success: true,
            message: "Property created successfully",
            propertyId
        });

    } catch (error) {

        await connection.rollback();
        connection.release();

        console.error("FULL ERROR:", error);

        res.status(500).json({
            success: false,
            message: error.sqlMessage || error.message,
            stack: error.stack
        });
    }

});

router.get("/", (req, res) => {
    const sql = `
   SELECT 
  p.id,
                p.name,
                p.full_overview,
                p.category,
                p.state,
                p.city,
                p.area,
                p.pincode,
                p.supplier_id,
                img.image_path AS cover_image,
                MIN(rr.base_price) AS starting_price
FROM properties p

LEFT JOIN property_images img
  ON p.id = img.property_id AND img.is_cover = 1

LEFT JOIN property_rooms pr
  ON p.id = pr.property_id

LEFT JOIN property_room_rates rr
  ON pr.id = rr.room_id
  AND rr.rate_type = 'weekday'
  AND rr.plan = 'EP'

WHERE p.status = 'Approved'

GROUP BY 
  p.id, p.name, p.category, p.state, p.city,
                p.area, p.pincode, p.supplier_id, img.image_path

ORDER BY p.id DESC
                `;

    db.query(sql, (err, results) => {
        if (err) {
            return res.status(500).json({ message: err.message });
        }

        res.json(results);
    });
});

// ================== GET SUPPLIER DASHBOARD ==================
router.get("/supplier/:supplierId", (req, res) => {
    const supplierId = Number(req.params.supplierId);

    if (!supplierId) {
        return res.status(400).json({ message: "Invalid supplier ID" });
    }

    const propertySql = `
    SELECT COUNT(*) AS totalProperties
    FROM properties
    WHERE supplier_id = ?
                `;

    db.query(propertySql, [supplierId], (err, propertyResult) => {
        if (err) {
            console.error("Property Count Error:", err);
            return res.status(500).json({ message: err.message });
        }

        // If bookings table doesn't exist yet, return zeros
        const bookingSql = `
      SELECT 
        COUNT(*) AS totalBookings,
                IFNULL(SUM(amount), 0) AS totalEarnings
      FROM bookings
      WHERE supplier_id = ?
                `;

        db.query(bookingSql, [supplierId], (err2, bookingResult) => {
            if (err2) {
                console.error("Booking Query Error:", err2);

                return res.json({
                    totalProperties: propertyResult[0]?.totalProperties || 0,
                    totalBookings: 0,
                    totalEarnings: 0,
                });
            }

            res.json({
                totalProperties: propertyResult[0]?.totalProperties || 0,
                totalBookings: bookingResult[0]?.totalBookings || 0,
                totalEarnings: bookingResult[0]?.totalEarnings || 0,
            });
        });
    });
});

// ================== GET SUPPLIER PROPERTIES ==================
router.get("/supplier/:supplierId/list", (req, res) => {
    const supplierId = req.params.supplierId;

    const sql = `
    SELECT 
      p.id,
                p.full_overview,
                p.name,
                p.category,
                p.area,
                p.state,
                p.city,
                p.pincode,
                img.image_path AS cover_image,
                MIN(rr.base_price) AS starting_price
    FROM properties p

    LEFT JOIN property_images img 
      ON p.id = img.property_id AND img.is_cover = 1

    LEFT JOIN property_rooms pr
      ON p.id = pr.property_id

    LEFT JOIN property_room_rates rr
      ON pr.id = rr.room_id
      AND rr.rate_type = 'weekday'
      AND rr.plan = 'EP'

    WHERE p.supplier_id = ?
                AND p.status != 'Deleted'

    GROUP BY 
      p.id, p.name, p.category, p.area, p.state, p.city, p.pincode, img.image_path

    ORDER BY p.id DESC
                `;

    db.query(sql, [supplierId], (err, results) => {
        if (err) {
            console.error("Fetch Properties Error:", err);
            return res.status(500).json({ message: err.message });
        }

        res.json(results);
    });
});

// ================== GET PROPERTY DETAILS ==================
router.get("/:propertyId", (req, res) => {
    const propertyId = req.params.propertyId;

    const propertySql = `SELECT * FROM properties WHERE id = ? `;
    const imageSql = `SELECT * FROM property_images WHERE property_id = ? `;
    const roomSql = `
SELECT pr.*, rr.plan, rr.rate_type, rr.base_price
FROM property_rooms pr
LEFT JOIN property_room_rates rr
ON pr.id = rr.room_id
WHERE pr.property_id = ?
                `;
    const policySql = `SELECT * FROM property_policies WHERE property_id = ? `;

    db.query(propertySql, [propertyId], (err, property) => {
        if (err) return res.status(500).json({ message: err.message });

        db.query(imageSql, [propertyId], (err2, images) => {
            if (err2) return res.status(500).json({ message: err2.message });

            db.query(roomSql, [propertyId], (err3, rooms) => {
                if (err3) return res.status(500).json({ message: err3.message });

                db.query(policySql, [propertyId], (err4, policies) => {
                    if (err4) return res.status(500).json({ message: err4.message });

                    res.json({
                        property: property[0],
                        images,
                        rooms,
                        policies: policies[0] || {},
                    });
                });
            });
        });
    });
});

// ================== GET FULL PROPERTY ==================
// ================== GET FULL PROPERTY ==================
router.get("/:id/full", async (req, res) => {

    const propertyId = req.params.id;

    try {

        // 1️⃣ Property
        const [property] = await db.promise().query(
            `SELECT p.*, s.state_name
FROM properties p
LEFT JOIN states s ON p.state = s.id
WHERE p.id = ? `,
            [propertyId]
        );

        if (!property.length) {
            return res.status(404).json({ message: "Property not found" });
        }

        // ❗ If deleted, block public access
        if (property[0].status === "Deleted") {
            return res.status(403).json({ message: "Property deleted" });
        }

        if (!property.length) {
            return res.status(404).json({ message: "Property not found" });
        }

        // 2️⃣ Images
        const [images] = await db.promise().query(
            `SELECT * FROM property_images WHERE property_id = ? `,
            [propertyId]
        );

        // 3️⃣ Videos
        const [videos] = await db.promise().query(
            `SELECT * FROM property_videos WHERE property_id = ? `,
            [propertyId]
        );

        // 4️⃣ Rooms
        const [rooms] = await db.promise().query(
            `
SELECT *
                FROM property_rooms
WHERE property_id = ?
                ORDER BY rate_type ASC
                `,
            [propertyId]
        );
        const [meals] = await db.promise().query(
            `SELECT * FROM property_meals WHERE property_id = ? `,
            [propertyId]
        );
        // 5️⃣ Rates
        const [rates] = await db.promise().query(
            `
            SELECT r.*
            FROM property_room_rates r
            JOIN property_rooms pr ON r.room_id = pr.id
            WHERE pr.property_id = ?
                `,
            [propertyId]
        );

        // 6️⃣ Policies
        const [policies] = await db.promise().query(
            `SELECT * FROM property_policies WHERE property_id = ? `,
            [propertyId]
        );

        // 7️⃣ Cancellation Rules
        const [cancellationRules] = await db.promise().query(
            `SELECT * FROM property_cancellation_rules WHERE property_id = ? `,
            [propertyId]
        );

        // 8️⃣ Staff
        // const [staff] = await db.promise().query(
        //     `SELECT * FROM property_staff WHERE property_id = ? `,
        //     [propertyId]
        // );

        const isAgent = req.headers.role === "agent"; // pass from frontend

        let staffQuery = `
  SELECT * FROM property_staff 
  WHERE property_id = ?
                `;

        if (isAgent) {
            staffQuery += ` AND is_active = 1`; // 🔥 only active for agent
        }

        const [staff] = await db.promise().query(staffQuery, [propertyId]);

        // 9️⃣ Amenities
        const [amenities] = await db.promise().query(
            `SELECT * FROM property_amenities WHERE property_id = ? `,
            [propertyId]
        );

        // 🔟 Sightseeing
        const [sightseeing] = await db.promise().query(
            `SELECT * FROM property_sightseeing WHERE property_id = ? `,
            [propertyId]
        );

        // 11️⃣ FAQs
        const [faqs] = await db.promise().query(
            `SELECT * FROM property_faqs WHERE property_id = ? `,
            [propertyId]
        );

        // 12️⃣ Check-in Data
        const [checkin] = await db.promise().query(
            `SELECT * FROM property_checkin WHERE property_id = ? `,
            [propertyId]
        );

        // 13️⃣ Bank Details
        // const [bank] = await db.promise().query(
        //     `SELECT * FROM property_bank_details WHERE property_id = ? `,
        //     [propertyId]
        // );

        const [banks] = await db.promise().query(
            "SELECT * FROM property_bank_details WHERE property_id = ?",
            [propertyId]
        );
        const [annualCharges] = await db.promise().query(
            `SELECT * FROM property_annual_charges
   WHERE property_id = ? LIMIT 1`,
            [propertyId]
        );
        res.json({
            property: property[0],
            images,
            videos,
            rooms,
            rates,
            meals,
            policies: policies[0] || {},
            cancellationRules,
            staff,
            amenities: amenities.map(
                (a) => a.amenity_name
            ),
            sightseeing,
            faqs,
            checkin: checkin[0] || {},
            bank_details: banks,
            annualCharges: annualCharges[0] || {}  // ✅ IMPORTANT
        });

    } catch (err) {
        console.error("FULL PROPERTY FETCH ERROR:", err);
        res.status(500).json({ message: "Server error" });
    }
});



// ================== SOFT DELETE PROPERTY ==================
router.put("/:id/delete", async (req, res) => {

    const propertyId = req.params.id;

    try {
        await db.promise().query(
            `UPDATE properties 
             SET status = 'Deleted' 
             WHERE id = ? `,
            [propertyId]
        );

        res.json({ success: true });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Failed to delete" });
    }
});


router.put("/staff/:id/delete", async (req, res) => {

    const staffId = req.params.id;

    await db.promise().query(
        `UPDATE property_staff 
         SET is_active = 0 
         WHERE id = ? `,
        [staffId]
    );

    res.json({ success: true });
});

router.put("/staff/:id/toggle", async (req, res) => {

    const { field, value } = req.body;

    if (!["show_phones", "show_emails", "show_photo"].includes(field)) {
        return res.status(400).json({ message: "Invalid field" });
    }

    await db.promise().query(
        `UPDATE property_staff SET ${field} =? WHERE id =? `,
        [value ? 1 : 0, req.params.id]
    );

    res.json({ success: true });

});
router.get("/property/:id/supplier", async (req, res) => {
    const propertyId = req.params.id;

    try {
        const [rows] = await db.promise().query(
            `
            SELECT 
                p.id AS property_id,
                p.supplier_id,
                u.id AS user_id,
                u.email,
                u.mobile
            FROM properties p
            LEFT JOIN users u ON p.supplier_id = u.id
            WHERE p.id = ?
                `,
            [propertyId]
        );

        console.log("SUPPLIER DEBUG:", rows[0]); // 🔥 MUST PRINT

        res.json(rows[0] || {});
    } catch (err) {
        console.error("SUPPLIER FETCH ERROR:", err);
        res.status(500).json({ message: "Error fetching supplier" });
    }
});
module.exports = router;