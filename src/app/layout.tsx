import type {Metadata} from "next";
import "./globals.css";
export const metadata:Metadata={title:"OJT Monitor | Secure Internship Monitoring",description:"Academic prototype for OJT and internship monitoring"};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
