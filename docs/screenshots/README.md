# Screenshots Directory

This directory contains visual artifacts and screenshots of the Pelican web application for documentation and evaluation.

## Required Screenshots

Please add the following 7 screenshot image files (`.png`) to this directory:

| Filename | Description | Screen / State |
|---|---|---|
| `pairing.png` | Session view with 6-character code, QR code modal, and "Waiting for the other device" status | `/session/:code` |
| `transfer.png` | Active file transfer in progress showing file name, transfer speed (MB/s), percentage bar, and ETA | `/session/:code` |
| `completed.png` | Finished transfer showing 100% completion status, elapsed duration, average speed, and SHA-256 hash preview | `/session/:code` |
| `history.png` | Transfer history view showing sent and received records, search bar, status filter, and pagination | `/history` |
| `devices.png` | Trusted devices dashboard showing registered machines/browsers, rename controls, and trust toggles | `/devices` |
| `login.png` | User authentication screen with email and password input card | `/login` |
| `dark-mode.png` | The interface rendered in dark theme mode demonstrating color palette and high contrast | Any screen in dark mode |

> Note: All images should be clear PNG captures representing standard desktop or mobile viewports.
