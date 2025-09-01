const  stripe = require("../config/stripe");  // ✅ fix import
const Course = require("../models/Course");
const User = require("../models/User");
const mailSender = require("../utils/mailSender");
const { courseEnrollmentEmail } = require("../mail/templates/courseEnrollmentEmail");
const { default: mongoose } = require("mongoose");


// capture the payment and initiate the Stripe payment intent
exports.capturePayment = async (req, res) => {
    const { course_id } = req.body;
    const userId = req.user.id;

    if (!course_id) {
        return res.json({
            success: false,
            message: 'Please provide valid course ID',
        });
    }

    let course;
    try {
        course = await Course.findById(course_id);
        if (!course) {
            return res.json({
                success: false,
                message: 'Could not find the course',
            });
        }

        const uid = new mongoose.Types.ObjectId(userId);
        if (course.studentsEnrolled.includes(uid)) {
            return res.status(200).json({
                success: false,
                message: 'Student is already enrolled',
            });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }

    const amount = course.price * 100; // Stripe works in paise/cents
    const currency = "INR";

    try {
        // initiate the payment using Stripe
        const paymentIntent = await stripe.paymentIntents.create({
            amount,
            currency,
            metadata: {
                courseId: course_id,
                userId,
            },
        });

        console.log(paymentIntent);

        return res.status(200).json({
            success: true,
            courseName: course.courseName,
            courseDescription: course.courseDescription,
            thumbnail: course.thumbnail,
            clientSecret: paymentIntent.client_secret, // Stripe uses clientSecret
            paymentIntentId: paymentIntent.id,        // ✅ added for debugging
            currency: paymentIntent.currency,
            amount: paymentIntent.amount,
        });
    } catch (error) {
        console.log(error);
        res.json({
            success: false,
            message: "Could not initiate payment",
        });
    }
};


// verify Stripe webhook signature
exports.verifySignature = async (req, res) => {
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET; // ✅ moved to .env
    const sig = req.headers["stripe-signature"];

    let event;
    try {
        event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    } catch (err) {
        console.log(err);
        return res.status(400).json({ success: false, message: `Webhook Error: ${err.message}` });
    }

    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const { courseId, userId } = paymentIntent.metadata;

        try {
            const enrolledCourse = await Course.findOneAndUpdate(
                { _id: courseId },
                { $push: { studentsEnrolled: userId } },
                { new: true },
            );

            if (!enrolledCourse) {
                return res.status(500).json({
                    success: false,
                    message: 'Course not Found',
                });
            }

            const enrolledStudent = await User.findOneAndUpdate(
                { _id: userId },
                { $push: { courses: courseId } },
                { new: true },
            );

            await mailSender(
                enrolledStudent.email,
                "Congratulations from CodeHelp",
                "Congratulations, you are onboarded into new CodeHelp Course",
            );

            return res.status(200).json({
                success: true,
                message: "Signature Verified and Course Added",
            });

        } catch (error) {
            console.log(error);
            return res.status(500).json({
                success: false,
                message: error.message,
            });
        }
    } else {
        return res.status(400).json({
            success: false,
            message: 'Invalid event type',
        });
    }
};
