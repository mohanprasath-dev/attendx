# I built a fraud-proof event attendance system in 5 days using Google Antigravity

## The Problem
Organizing events at college is exciting, but managing attendance is a nightmare. As the President of the Gen AI Club at NIAT × Crescent, I've seen firsthand how proxy attendance, duplicate entries, and fake certificate claims plague student-run events. Paper sign-ups are slow and easily forged, while generic Google Forms allow anyone with the link to claim attendance without actually being present.

We needed a system that was fast, reliable, and practically impossible to spoof.

## The Solution: AttendX
I built **AttendX** — a smart event attendance platform designed specifically to combat these issues. AttendX uses dynamic QR codes, multi-round scanning, and automatic certificate eligibility to ensure that only true attendees get credit.

Here's how it works:
1. Organizers create an event with multiple rounds (e.g., "Check-in", "Workshop 1", "Finals").
2. Participants are added (manually or via CSV) and each receives a unique, dynamic QR code.
3. Volunteers use their smartphone cameras to scan the QR codes at the entrance of each round.
4. The system automatically cross-references scans in real-time, instantly flagging duplicate entries or invalid codes.
5. Participants who complete the required rounds are automatically marked as "Certificate Eligible".

## How I built it
The entire platform was built in just 5 days using:
* **Next.js 14 (App Router)** for the full-stack framework
* **Firebase (Firestore + Auth)** for the real-time database and secure Google login
* **html5-qrcode** for building the mobile-first volunteer scanning dashboard
* **Docker & Google Cloud Run** for a robust, scalable deployment

## Key Challenges
The two biggest hurdles were the real-time duplicate detection and the mobile-first scanner. The scanning dashboard needed to be fast and intuitive, as volunteers are often using varying smartphone models in less-than-ideal lighting conditions. Leveraging `html5-qrcode` allowed me to tap directly into the device's camera stream with minimal friction.

For duplicate detection, I utilized Firestore's real-time querying capabilities to immediately reject subsequent scans for the same participant and round, preventing the dreaded "proxy scan."

## What Google Antigravity Enabled
The real secret weapon here was **Google Antigravity**. By crafting highly specific, architectural prompts, I was able to generate the core logic, UI components, and even the complex Firestore queries without writing every line of code by hand. It dramatically accelerated the development lifecycle. Instead of wrestling with boilerplate and API integrations, I could focus entirely on the product logic and the user experience. Antigravity essentially acted as an extremely competent pair programmer.

## Demo & Source Code
You can check out the live demo and explore the source code below:
* **Live App:** [Insert Cloud Run Deployed URL]
* **GitHub Repo:** [Insert GitHub Repo Link]

## What's Next?
This is just the MVP. In future iterations, I plan to add:
* **Location Validation:** Ensure the scan happens within a specific geofence.
* **Email Certificates:** Automatically email PDF certificates to eligible participants upon event completion.
* **Multi-Organizer Support:** Allow multiple admins to manage the same event securely.

Building AttendX has been an incredible experience, and I'm excited to see how it can streamline events across campuses!
