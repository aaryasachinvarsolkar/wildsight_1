import React, { useState, useEffect } from 'react';
import {
    User,
    Mail,
    Phone,
    Building2,
    MapPin,
    Key,
    Copy,
    Check,
    Edit2,
    Save,
    ArrowLeft
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const REGIONS = [
    "Northern India",
    "Southern India",
    "Eastern India",
    "Western India",
    "Central India",
    "North-East India",
    "Andaman & Nicobar",
    "Lakshadweep",
    "Other"
];

const UserProfile = () => {
    const navigate = useNavigate();
    const [isEditing, setIsEditing] = useState(false);
    const [copiedId, setCopiedId] = useState(false);
    const [copiedKey, setCopiedKey] = useState(false);

    const [profile, setProfile] = useState({
        name: '',
        email: '',
        contact: '',
        organizationName: '',
        region: 'Northern India',
        userId: '',
        apiKey: ''
    });

    useEffect(() => {
        const saved = localStorage.getItem('wildsight_user_profile');
        if (saved) {
            const parsed = JSON.parse(saved);
            // Migrate old profile shape if needed
            setProfile({
                name: parsed.name || (parsed.firstName ? `${parsed.firstName} ${parsed.lastName}`.trim() : ''),
                email: parsed.email || '',
                contact: parsed.contact || '',
                organizationName: parsed.organizationName || '',
                region: parsed.region || 'Northern India',
                userId: parsed.userId || crypto.randomUUID(),
                apiKey: parsed.apiKey || "sk_live_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
            });
        } else {
            const newProfile = {
                ...profile,
                userId: crypto.randomUUID(),
                apiKey: "sk_live_" + Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)
            };
            setProfile(newProfile);
            localStorage.setItem('wildsight_user_profile', JSON.stringify(newProfile));
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('wildsight_user_profile', JSON.stringify(profile));
        setIsEditing(false);
    };

    const copyToClipboard = (text, type) => {
        navigator.clipboard.writeText(text);
        if (type === 'id') {
            setCopiedId(true);
            setTimeout(() => setCopiedId(false), 2000);
        } else {
            setCopiedKey(true);
            setTimeout(() => setCopiedKey(false), 2000);
        }
    };

    const inputClass = (editing) =>
        `w-full bg-slate-900/50 border ${editing ? 'border-emerald-500/50 focus:border-emerald-500' : 'border-slate-700'} rounded-xl px-4 py-3 text-slate-200 focus:outline-none transition-all`;

    return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-6">
            <div className="max-w-2xl w-full">

                {/* Header */}
                <div className="flex items-center gap-4 mb-8">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <h1 className="text-3xl font-bold tracking-tight text-white">User Profile</h1>
                </div>

                <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-8 shadow-xl backdrop-blur-sm">
                    <div className="space-y-6">

                        {/* NAME */}
                        <div className="group relative">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <User size={12} /> Name
                            </label>
                            <input
                                type="text"
                                disabled={!isEditing}
                                value={profile.name}
                                onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                                placeholder="Your full name"
                                className={inputClass(isEditing)}
                            />
                        </div>

                        {/* EMAIL */}
                        <div className="group relative">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <Mail size={12} /> Email
                            </label>
                            <input
                                type="email"
                                disabled={!isEditing}
                                value={profile.email}
                                onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                                placeholder="you@example.com"
                                className={inputClass(isEditing)}
                            />
                        </div>

                        {/* CONTACT */}
                        <div className="group relative">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <Phone size={12} /> Contact
                            </label>
                            <input
                                type="tel"
                                disabled={!isEditing}
                                value={profile.contact}
                                onChange={(e) => setProfile({ ...profile, contact: e.target.value })}
                                placeholder="+91 XXXXX XXXXX"
                                className={inputClass(isEditing)}
                            />
                        </div>

                        {/* ORGANIZATION NAME */}
                        <div className="group relative">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <Building2 size={12} /> Organization Name
                            </label>
                            <input
                                type="text"
                                disabled={!isEditing}
                                value={profile.organizationName}
                                onChange={(e) => setProfile({ ...profile, organizationName: e.target.value })}
                                placeholder="Your organization"
                                className={inputClass(isEditing)}
                            />
                        </div>

                        {/* REGION */}
                        <div className="group relative">
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <MapPin size={12} /> Region
                            </label>
                            <select
                                disabled={!isEditing}
                                value={profile.region}
                                onChange={(e) => setProfile({ ...profile, region: e.target.value })}
                                className={`${inputClass(isEditing)} appearance-none`}
                            >
                                {REGIONS.map(r => <option key={r}>{r}</option>)}
                            </select>
                        </div>

                        <div className="h-px bg-slate-700 my-2"></div>

                        {/* USER ID */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <Key size={12} /> User ID
                            </label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 font-mono text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                                    {profile.userId}
                                </code>
                                <button
                                    onClick={() => copyToClipboard(profile.userId, 'id')}
                                    className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors text-slate-400 hover:text-white"
                                >
                                    {copiedId ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* API KEY */}
                        <div>
                            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1 flex items-center gap-2">
                                <Key size={12} /> API Key
                            </label>
                            <div className="flex items-center gap-2">
                                <code className="flex-1 bg-slate-900/80 border border-slate-700 rounded-xl px-4 py-3 text-slate-400 font-mono text-sm overflow-hidden text-ellipsis whitespace-nowrap">
                                    {profile.apiKey}
                                </code>
                                <button
                                    onClick={() => copyToClipboard(profile.apiKey, 'key')}
                                    className="p-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl transition-colors text-slate-400 hover:text-white"
                                >
                                    {copiedKey ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
                                </button>
                            </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="pt-4 flex justify-center">
                            {isEditing ? (
                                <button
                                    onClick={handleSave}
                                    className="flex items-center gap-2 px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all shadow-lg hover:shadow-emerald-500/20"
                                >
                                    <Save size={18} /> SAVE CHANGES
                                </button>
                            ) : (
                                <button
                                    onClick={() => setIsEditing(true)}
                                    className="flex items-center gap-2 px-8 py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-all border border-slate-600"
                                >
                                    <Edit2 size={18} /> EDIT PROFILE
                                </button>
                            )}
                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};

export default UserProfile;
