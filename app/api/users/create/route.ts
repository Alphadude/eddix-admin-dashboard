import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, firstName, lastName, phoneNumber } = body;

        // Validate inputs
        if (!email || !firstName || !lastName || !phoneNumber) {
            return NextResponse.json(
                { error: "All fields are required" },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: "Invalid email format" },
                { status: 400 }
            );
        }

        // 1. Create user in Firebase Authentication
        const userRecord = await adminAuth.createUser({
            email,
            password: "123456",
        });

        const uid = userRecord.uid;
        const now = Timestamp.now();

        // 2. Create user document in Firestore "users" collection
        const userData = {
            uid: uid,
            email: email,
            firstName: firstName,
            lastName: lastName,
            phoneNumber: phoneNumber,
            isVerified: true,
            status: "active",
            verificationCode: "",
            verificationCodeExpiry: now,
            createdAt: now,
            updatedAt: now,
        };

        await adminDb.collection("users").doc(uid).set(userData);

        // Return complete user data
        return NextResponse.json({
            success: true,
            uid: uid,
            user: userData
        }, { status: 201 });

    } catch (error: any) {
        console.error("Error creating user:", error);

        // Map Firebase error codes to user-friendly messages
        let errorMessage = "Failed to create user";

        if (error.code === "auth/email-already-exists") {
            errorMessage = "This email address is already registered";
        } else if (error.code === "auth/invalid-email") {
            errorMessage = "Invalid email address";
        } else if (error.code === "auth/invalid-phone-number") {
            errorMessage = "Invalid phone number format";
        } else if (error.code === "auth/phone-number-already-exists") {
            errorMessage = "This phone number is already registered";
        } else if (error.message) {
            errorMessage = error.message;
        }

        return NextResponse.json(
            { error: errorMessage },
            { status: 500 }
        );
    }
}

