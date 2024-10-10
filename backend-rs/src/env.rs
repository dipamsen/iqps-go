use std::path::PathBuf;

use clap::Parser;
use hmac::{digest::InvalidLength, Hmac, Mac};
use sha2::Sha256;

#[derive(Parser, Clone)]
pub struct EnvVars {
    // Database
    #[arg(env)]
    /// Database name
    pub db_name: String,
    #[arg(env)]
    /// Database hostname
    pub db_host: String,
    #[arg(env)]
    /// Database port
    pub db_port: String,
    #[arg(env)]
    /// Database username
    pub db_user: String,
    #[arg(env)]
    /// Database password
    pub db_password: String,

    // Auth
    #[arg(env)]
    /// OAuth app client id (public token)
    pub gh_client_id: String,
    #[arg(env)]
    /// OAuth app private token
    pub gh_private_id: String,
    #[arg(env)]
    /// Github organization name
    pub gh_org_name: String,
    #[arg(env)]
    /// Github organization team slug (this team has access to admin dashboard)
    pub gh_org_team_slug: String,
    #[arg(env)]
    /// An org admin's Github token (with the `read:org` permission)
    pub gh_org_admin_token: String,
    #[arg(env)]
    /// JWT encryption secret (make it a long, randomized string)
    jwt_secret: String,

    // Other configs
    #[arg(env, default_value = "10")]
    /// Maximum number of papers that can be uploaded at a time
    pub max_upload_limit: i32,
    #[arg(env, default_value = "./log/application.log")]
    /// Location where logs are stored
    pub log_location: PathBuf,

    // Paths
    #[arg(env, default_value = "https://static.metakgp.org")]
    /// The URL of the static files server (odin's vault)
    pub static_files_url: String,
    #[arg(env, default_value = "/srv/static")]
    /// The path where static files are served from
    pub static_file_storage_location: PathBuf,
    #[arg(env, default_value = "iqps/uploaded")]
    /// The path where uploaded papers are stored temporarily, relative to the `static_file_storage_location`
    pub uploaded_qps_path: PathBuf,

    // Server
    #[arg(env, default_value = "8080")]
    /// The port the server listens on
    pub server_port: i32,

    // CORS
    #[arg(env, default_value = "https://qp.metakgp.org,http://localhost:5173")]
    /// List of origins allowed (as a list of values separated by commas `origin1, origin2`)
    pub cors_allowed_origins: String,
}

impl EnvVars {
    /// Processes the environment variables after reading.
    pub fn process(mut self) -> Result<Self, Box<dyn std::error::Error>> {
        self.static_file_storage_location = std::path::absolute(self.static_file_storage_location)?;
        self.uploaded_qps_path = std::path::absolute(
            self.static_file_storage_location
                .join(self.uploaded_qps_path),
        )?;

        self.log_location = std::path::absolute(self.log_location)?;
        Ok(self)
    }

    /// Returns the JWT signing key
    pub fn get_jwt_key(&self) -> Result<Hmac<Sha256>, InvalidLength> {
        Hmac::new_from_slice(self.jwt_secret.as_bytes())
    }
}
