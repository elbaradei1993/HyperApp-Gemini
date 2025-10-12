import React from 'react';

// Common props for all icons
interface IconProps extends React.SVGProps<SVGSVGElement> {}

export const FireIcon: React.FC<IconProps> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M12.963 2.286a.75.75 0 00-1.071 1.052A9.75 9.75 0 0110.303 15.39a.75.75 0 001.218.885 11.245 11.245 0 004.949-5.113.75.75 0 00-1.5-.558 9.748 9.748 0 01-3.008 4.293.75.75 0 00.165 1.127 12.72 12.72 0 005.416-4.137.75.75 0 10-1.218-.885 11.217 11.217 0 01-4.202 3.82.75.75 0 00-.327 1.185 13.5 13.5 0 006.452-3.873.75.75 0 10-1.118-1.002A12.002 12.002 0 0115 15.176a.75.75 0 00.28 1.18A15.003 15.003 0 0021 12a.75.75 0 00-1.5 0 13.5 13.5 0 01-5.012 9.682.75.75 0 10.885 1.218A15.001 15.001 0 0015 3.371a.75.75 0 00-2.037-1.085z" clipRule="evenodd" />
  </svg>
);

export const LocationMarkerIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M11.54 22.351l.07.04.028.016a.76.76 0 00.723 0l.028-.015.071-.041a16.975 16.975 0 005.16-4.053A17.58 17.58 0 0018 12.75C18 9.362 15.314 6.75 12 6.75S6 9.362 6 12.75c0 2.228.847 4.243 2.223 5.553a16.975 16.975 0 005.16 4.053l-.01.008zM12 15.75a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
);

export const LightBulbIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM5.106 17.834a.75.75 0 001.06 1.06l1.59-1.591a.75.75 0 00-1.06-1.06l-1.591 1.59zM8.25 12a.75.75 0 01-.75.75H5.25a.75.75 0 010-1.5H7.5A.75.75 0 018.25 12zM6.166 5.106a.75.75 0 00-1.06 1.06l1.59 1.591a.75.75 0 001.06-1.06l-1.59-1.591z" />
    </svg>
);

export const SearchIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M10.5 3.75a6.75 6.75 0 100 13.5 6.75 6.75 0 000-13.5zM2.25 10.5a8.25 8.25 0 1114.59 5.28l4.69 4.69a.75.75 0 11-1.06 1.06l-4.69-4.69A8.25 8.25 0 012.25 10.5z" clipRule="evenodd" />
    </svg>
);

export const MicrophoneIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M8.25 4.5a3.75 3.75 0 117.5 0v8.25a3.75 3.75 0 11-7.5 0V4.5z" />
        <path d="M6 10.5a.75.75 0 01.75.75v1.5a5.25 5.25 0 1010.5 0v-1.5a.75.75 0 011.5 0v1.5a6.75 6.75 0 11-13.5 0v-1.5A.75.75 0 016 10.5z" />
    </svg>
);

export const BellAlertIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M11.25 4.533A9.708 9.708 0 001.5 12c0 5.385 4.365 9.75 9.75 9.75s9.75-4.365 9.75-9.75c0-4.11-2.548-7.583-6.075-8.967zM12 6.75a.75.75 0 00-.75.75v3.75a.75.75 0 001.5 0V7.5a.75.75 0 00-.75-.75zM12 15a.75.75 0 00-.75.75v.008c0 .414.336.75.75.75h.008a.75.75 0 00.75-.75v-.008a.75.75 0 00-.75-.75H12z" />
    </svg>
);

export const GlobeAltIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM8.25 7.5a.75.75 0 000 1.5h7.5a.75.75 0 000-1.5h-7.5zM9 11.25a.75.75 0 000 1.5h6a.75.75 0 000-1.5H9z" clipRule="evenodd" />
    </svg>
);

export const TrashIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.006a.75.75 0 01-.749.658h-7.5a.75.75 0 01-.749-.658L5.168 6.63c-.073.012-.144.024-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5.058l.347 9a.75.75 0 101.499-.058l-.347-9zm5.292 0a.75.75 0 10-1.5.058l.347 9a.75.75 0 001.5-.058l-.347-9z" clipRule="evenodd" />
    </svg>
);

export const PencilSquareIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path d="M21.731 2.269a2.625 2.625 0 00-3.712 0l-1.157 1.157 3.712 3.712 1.157-1.157a2.625 2.625 0 000-3.712zM19.513 8.199l-3.712-3.712-12.15 12.15a.75.75 0 00-.22 1.064l2.122 2.121a.75.75 0 001.063-.22L19.513 8.2z" />
    </svg>
);

export const UserIcon: React.FC<IconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
        <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
    </svg>
);

export const PlusCircleIcon: React.FC<IconProps> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zM12.75 9a.75.75 0 00-1.5 0v2.25H9a.75.75 0 000 1.5h2.25V15a.75.75 0 001.5 0v-2.25H15a.75.75 0 000-1.5h-2.25V9z" clipRule="evenodd" />
  </svg>
);

export const UserGroupIcon: React.FC<IconProps> = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0z" />
    <path fillRule="evenodd" d="M5.25 15.375a2.625 2.625 0 012.625-2.625h3.375a2.625 2.625 0 012.625 2.625 4.5 4.5 0 01-8.25 0zM14.25 15.375a2.625 2.625 0 012.625-2.625h.75a2.625 2.625 0 012.625 2.625 4.5 4.5 0 01-6 0z" clipRule="evenodd" />
  </svg>
);
