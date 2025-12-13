import { NextResponse } from "next/server";
import { adminAuth, adminDb } from "../../../../lib/firebase-admin";
import { Timestamp } from "firebase-admin/firestore";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { email, firstName, lastName, phoneNumber } = body;

        // 1. Create user in Firebase Authentication
        // We set a default password as requested: "123456"
        // In a real app, you might generate a random password or send an invite link.
        const userRecord = await adminAuth.createUser({
            email,
            password: "123456",
            displayName: `${firstName} ${lastName}`,
            phoneNumber: phoneNumber, // Ensure phone number is in E.164 format (e.g. +234...)
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
            isVerified: false,
            status: "active",
            verificationCode: "", // Empty initially
            verificationCodeExpiry: now, // Determine expiry logic if needed
            createdAt: now,
            updatedAt: now,
        };

        await adminDb.collection("users").doc(uid).set(userData);

        return NextResponse.json({ success: true, uid: uid }, { status: 201 });
    } catch (error: any) {
        console.error("Error creating user:", error);
        return NextResponse.json(
            { error: error.message || "Failed to create user" },
            { status: 500 }
        );
    }
}
