import "./globals.css";

export const metadata = {
    title: "ApplyIQ — AI Career Coach",
    description: "Upload CVs, paste job descriptions, and get AI-powered coaching.",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <head>
                <link rel="preconnect" href="https://fonts.googleapis.com" />
                <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600&family=Outfit:wght@400;500;600&display=swap" rel="stylesheet" />
            </head>
            <body style={{ margin: 0, padding: 0 }}>{children}</body>
        </html>
    );
}
