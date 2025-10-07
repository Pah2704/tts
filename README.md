# TTS-VTN

A robust, scalable Text-to-Speech (TTS) system featuring a web interface, background workers, and integrated quality control.

## Quickstart

1.  Clone the repository and navigate into the project directory.
2.  Create your environment configuration file from the example:
    ```bash
    cp .env.example .env
    ```
3.  Review and adjust settings in `.env` as needed.
4.  Download the required TTS models into the designated model directory.
5.  Build and launch the application stack with Docker Compose:
    ```bash
    docker-compose up --build -d
    ```
6.  Access the web interface at `http://localhost:3000`.

For a more detailed setup guide, please see [docs/quickstart.md](./docs/quickstart.md).
All configuration variables are documented in [docs/CONFIG.md](./docs/CONFIG.md).

## Key Concepts

*   **Real-time Progress**: The frontend receives job status updates via Server-Sent Events (SSE). The connection replays the full event history for a job upon connection and closes automatically when the final state is reached.
*   **Mandatory Quality Control (QC)**: Before any audio can be exported, it must pass a mandatory Quality Control check. This ensures all output meets predefined standards for loudness (LUFS), peak levels, and clarity.