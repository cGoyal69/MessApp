const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const nodemailer = require("nodemailer");
const cors = require('cors');

const app = express();
const PORT = 3000;

let otpStore = {}; // Store OTPs temporarily
const EMAIL_USER = "c92084860@gmail.com";
const EMAIL_PASS = "skby bqhs bizg jgbv";

// Middleware
app.use(bodyParser.json());
app.use(cors());

// MongoDB Connection
mongoose.connect('mongodb+srv://avnadmin:AVNS_AvANMiNmvDBnWSYkCF8@messapp.mongodb.net/mess', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
});
const db = mongoose.connection;

db.on('error', console.error.bind(console, 'MongoDB connection error:'));
db.once('open', () => console.log('Connected to MongoDB'));

// Mongoose Schemas
const userSchema = new mongoose.Schema({
    name: String,
    email: String,
    rollNo: String,
    preference: String,
    photo: String,
    allowed: { type: Boolean, default: true }
});

const attendanceSchema = new mongoose.Schema({
    rollNo: String,
    date: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Attendance = mongoose.model('Attendance', attendanceSchema);

// Helper Function to Check Attendance
const attendanceCount = async (rollNumber) => {
    const count = await Attendance.countDocuments({ rollNo: rollNumber, date: { $gte: new Date().setHours(0,0,0,0) } });
    return count > 2 ? 'Visited' : 'Pass';
};

const decideUser = async (email) => {
    const user = await User.findOne({ email });
    return user?.preference === 'mess' ? 'worker' : user?.preference === 'admin' ? 'admin' : 'student';
};

// Routes
app.get('/students', async (req, res) => {
    const students = await User.find();
    res.json(students);
});

app.post('/students/get', async (req, res) => {
    const { rollNumber, preference } = req.body;
    const student = await User.findOne({ rollNo: rollNumber, preference });
    if (!student || !student.allowed) {
        return res.status(404).json({ message: 'Student not allowed or not found' });
    }
    const entryStatus = await attendanceCount(student.rollNo);
    res.json({ student, entry: entryStatus });
});

app.post('/add-user', async (req, res) => {
    const newUser = new User(req.body);
    await newUser.save();
    res.status(201).json({ success: 'User added successfully' });
});

app.put('/students/update', async (req, res) => {
    const { rollNo, name, email, preference } = req.body;
    const student = await User.findOneAndUpdate({ rollNo }, { name, email, preference }, { new: true });
    if (!student) return res.status(404).json({ message: 'Student not found' });
    res.json({ message: 'Student updated successfully', student });
});

app.put('/update_allowed_status', async (req, res) => {
    const { rollNo, allowed } = req.body;
    const user = await User.findOneAndUpdate({ rollNo }, { allowed }, { new: true });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: 'User status updated successfully' });
});

app.delete('/students/remove', async (req, res) => {
    const { rollNo } = req.body;
    const result = await User.findOneAndDelete({ rollNo });
    if (!result) return res.status(404).json({ message: 'Student not found' });
    res.json({ success: 'Student removed successfully' });
});

app.post("/send-otp", async (req, res) => {
    const { email } = req.body;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = otp;
    let transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: EMAIL_USER, pass: EMAIL_PASS },
    });
    let mailOptions = {
        from: EMAIL_USER,
        to: email,
        subject: `IIIT Manipur Mess Login Credential OTP is ${otp}`,
        text: `Your OTP is: ${otp}`
    };
    try {
        await transporter.sendMail(mailOptions);
        res.json({ success: true, message: "OTP sent successfully" });
    } catch (error) {
        res.status(500).json({ error: "Failed to send OTP" });
    }
});

app.post("/verify-otp", async (req, res) => {
    const { email, otp } = req.body;
    if (otpStore[email] && otpStore[email] === otp) {
        delete otpStore[email];
        const userType = await decideUser(email);
        res.json({ success: true, message: "OTP verified", userType });
    } else {
        res.status(400).json({ error: "Invalid OTP" });
    }
});

app.put('/students/:rollNumber', async (req, res) => {
    const { rollNumber } = req.params;
    const newAttendance = new Attendance({ rollNo: rollNumber });
    await newAttendance.save();
    res.json({ message: 'Attendance updated successfully' });
});

app.post('/students/attendance', async (req, res) => {
    const { rollNumber } = req.body;
    const attendanceTimes = await Attendance.find({ rollNo: rollNumber, date: { $gte: new Date().setHours(0,0,0,0) } })
        .select('date');
    res.json({ attendanceTimes: attendanceTimes.map(a => a.date.toTimeString().split(' ')[0]) });
});

app.get('/mess/stats', async (req, res) => {
    const stats = await User.aggregate([{ $group: { _id: "$preference", count: { $sum: 1 } } }]);
    res.json(stats);
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
});
