import React, { useContext } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../services/supabaseClient';
import { useData } from '../contexts/DataContext';

type Theme = 'light' | 'dark' | 'system';

const Settings: React.FC = () => {
    const navigate = useNavigate();
    const { 
        userSettings, 
        updateUserSettings, 
        clearAiCache,
    } = useData();
    const [theme, setTheme] = React.useState<Theme>('system');

    React.useEffect(() => {
        const savedTheme = localStorage.getItem('hyperapp-theme') as Theme | null;
        if (savedTheme) {
            setTheme(savedTheme);
        }
    }, []);

    const handleThemeChange = (newTheme: Theme) => {
        setTheme(newTheme);
        localStorage.setItem('hyperapp-theme', newTheme);
        applyTheme(newTheme);
    };

    const applyTheme = (themeValue: Theme) => {
        const body = document.body;
        const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
        
        body.classList.remove('bg-brand-primary', 'text-white', 'bg-gray-100', 'text-black');

        if (themeValue === 'dark' || (themeValue === 'system' && darkQuery.matches)) {
            body.classList.add('bg-brand-primary', 'text-white');
        } else {
            body.classList.add('bg-gray-100', 'text-black');
        }
    };
    
    const handleSettingToggle = (category: 'notifications' | 'privacy' | 'map', key: string, value: any) => {
        const newSettings = {
            ...userSettings,
            [category]: {
                ...userSettings[category],
                [key]: value
            }
        };
        updateUserSettings(newSettings);
    };

    const handleSignOut = async () => {
        await supabase.auth.signOut();
        navigate('/login', { replace: true });
    };

    const handleDeleteAccount = () => {
        alert("Account deletion is a placeholder feature. In a real app, this would trigger a secure server-side process.");
    };

    const SettingCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
        <div className="bg-brand-secondary p-4 rounded-lg space-y-3">
            <h2 className="text-xl font-semibold border-b border-gray-700 pb-2">{title}</h2>
            <div className="pt-2 space-y-4">
                {children}
            </div>
        </div>
    );
    
    const SettingToggle: React.FC<{id: string; label: string; description: string; isChecked: boolean; onToggle: (isChecked: boolean) => void;}> = ({ id, label, description, isChecked, onToggle }) => (
        <div className="flex items-start justify-between">
            <div className="pr-4">
                <label htmlFor={id} className="font-semibold cursor-pointer">{label}</label>
                <p className="text-sm text-gray-400">{description}</p>
            </div>
            <div className="relative inline-block w-10 align-middle select-none transition duration-200 ease-in flex-shrink-0">
                <input
                    type="checkbox"
                    name={id}
                    id={id}
                    checked={isChecked}
                    onChange={(e) => onToggle(e.target.checked)}
                    className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer"
                />
                <label htmlFor={id} className="toggle-label block overflow-hidden h-6 rounded-full bg-gray-600 cursor-pointer"></label>
            </div>
        </div>
    );
    
    const RadioGroup: React.FC<{ legend: string; name: string; options: { value: string; label: string }[]; selectedValue: string; onChange: (value: string) => void }> = ({ legend, name, options, selectedValue, onChange }) => (
        <div>
            <p className="font-semibold">{legend}</p>
            <div className="flex space-x-2 bg-brand-primary p-1 rounded-lg mt-2">
                {options.map(opt => (
                     <button
                        key={opt.value}
                        onClick={() => onChange(opt.value)}
                        className={`flex-1 text-sm font-semibold py-2 rounded-md transition-colors ${
                            selectedValue === opt.value ? 'bg-brand-accent text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
        </div>
    );

    return (
        <div className="p-4 space-y-6">
            <style>{`.toggle-checkbox:checked { right: 0; border-color: #4299e1; } .toggle-checkbox:checked + .toggle-label { background-color: #4299e1; }`}</style>
            <div>
                <h1 className="text-3xl font-bold">Settings</h1>
                <p className="text-gray-400">Customize your HyperAPP experience.</p>
            </div>

            <SettingCard title="General">
                 <Link to="/profile" className="block w-full text-left bg-gray-700 p-3 rounded-md hover:bg-gray-600 transition-colors">
                    <p className="font-semibold">Edit Profile</p>
                    <p className="text-sm text-gray-400">Manage your username, name, and avatar.</p>
                </Link>
                <RadioGroup 
                    legend="Appearance"
                    name="theme"
                    options={[{value: 'light', label: 'Light'}, {value: 'dark', label: 'Dark'}, {value: 'system', label: 'System'}]}
                    selectedValue={theme}
                    onChange={(val) => handleThemeChange(val as Theme)}
                />
            </SettingCard>
            
            <SettingCard title="Notifications">
                <SettingToggle
                    id="safeZoneAlerts"
                    label="Enable Safe Zone Alerts"
                    description="Receive notifications for critical events inside your saved safe zones."
                    isChecked={userSettings.notifications.safeZoneAlerts}
                    onToggle={(val) => handleSettingToggle('notifications', 'safeZoneAlerts', val)}
                />
                <div className={`space-y-4 pl-4 border-l-2 border-gray-700 ${!userSettings.notifications.safeZoneAlerts ? 'opacity-50' : ''}`}>
                    <SettingToggle
                        id="onDangerousVibe"
                        label='"Dangerous" Vibe Alerts'
                        description="Get notified when a 'Dangerous' vibe is reported."
                        isChecked={userSettings.notifications.onDangerousVibe}
                        onToggle={(val) => handleSettingToggle('notifications', 'onDangerousVibe', val)}
                    />
                    <SettingToggle
                        id="onSOS"
                        label="SOS Alerts"
                        description="Get notified for new SOS alerts."
                        isChecked={userSettings.notifications.onSOS}
                        onToggle={(val) => handleSettingToggle('notifications', 'onSOS', val)}
                    />
                </div>
            </SettingCard>
            
            <SettingCard title="Privacy & Data">
                 <SettingToggle
                    id="anonymousByDefault"
                    label="Post Anonymously by Default"
                    description="When enabled, new vibes you report will not show your username."
                    isChecked={userSettings.privacy.anonymousByDefault}
                    onToggle={(val) => handleSettingToggle('privacy', 'anonymousByDefault', val)}
                />
                 <button onClick={clearAiCache} className="w-full bg-gray-700 text-white font-bold py-2 px-4 rounded-md hover:bg-gray-600">
                    Clear Local AI Cache
                </button>
            </SettingCard>

            <SettingCard title="Map & Display">
                <RadioGroup 
                    legend="Default Map View"
                    name="mapView"
                    options={[{value: 'heatmap', label: 'Heatmap'}, {value: 'markers', label: 'Markers'}]}
                    selectedValue={userSettings.map.defaultView}
                    onChange={(val) => handleSettingToggle('map', 'defaultView', val)}
                />
            </SettingCard>

            <SettingCard title="Account">
                <button onClick={handleSignOut} className="w-full bg-blue-600/80 text-white font-bold py-2 px-4 rounded-md hover:bg-blue-700">
                    Sign Out
                </button>
                 <button onClick={handleDeleteAccount} className="w-full bg-red-800/80 text-red-200 font-bold py-2 px-4 rounded-md hover:bg-red-700">
                    Delete Account
                </button>
            </SettingCard>
        </div>
    );
};

export default Settings;