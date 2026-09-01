import Seo from '../../../shared/components/Seo';
import React from 'react';
import { ShieldCheck } from 'lucide-react';

const Privacy: React.FC = () => {
    return (
        <>
        <Seo
            title="Privacy Policy | NexPlay"
            description="Read NexPlay's privacy policy. Learn how we handle your data on Nepal's esports tournament platform."
            canonicalPath="/privacy"
            noindex
        />
        <div className="animate-fade-in max-w-4xl mx-auto">
            <div className="bg-card p-5 sm:p-8 rounded-xl border border-gray-800 shadow-2xl">
                <h1 className="text-2xl sm:text-3xl font-bold text-white mb-6 border-b border-gray-700 pb-4 flex items-center">
                    <ShieldCheck className="mr-3 text-brand-500 w-8 h-8" /> Privacy Policy
                </h1>
                <div className="space-y-6 text-gray-300 text-sm leading-relaxed h-[60vh] overflow-y-auto custom-scrollbar pr-2">
                    <section>
                        <h3 className="text-white font-bold text-lg mb-2">1. Introduction</h3>
                        <p>NexPlay (“we”, “our”, “us”) respects your privacy and is committed to protecting your personal information. This Privacy Policy explains how we collect, use, and safeguard your data when you use our platform for hosting and participating in tournaments and scrims.</p>
                    </section>
                    <section>
                        <h3 className="text-white font-bold text-lg mb-2">2. Information We Collect</h3>
                        <ul className="list-disc pl-5 space-y-1 text-gray-400">
                            <li><strong>Account Information:</strong> Username, email address, phone number, and In-Game IDs.</li>
                            <li><strong>Transaction Data:</strong> Details of deposits and withdrawals.</li>
                            <li><strong>Usage Data:</strong> Information about how you interact with our tournaments and features.</li>
                        </ul>
                    </section>
                    <section>
                        <h3 className="text-white font-bold text-lg mb-2">3. How We Use Your Information</h3>
                        <p>We use the information we collect to provide, maintain, and improve our services, to process transactions, and to communicate with you about tournaments and updates.</p>
                    </section>
                    <div className="mt-8 pt-4 border-t border-gray-700">
                        <p className="text-xs text-gray-500">Last Updated: October 2025</p>
                    </div>
                </div>
            </div>
        </div>
        </>
    );
};

export default Privacy;
