use veil_attestation::veil_attestation::VeilAttestationContractRef;

fn main() {
    let module = std::env::var("ODRA_MODULE").unwrap_or_default();

    match module.as_str() {
        "VeilAttestation" => {
            let legacy = VeilAttestationContractRef::schema();
            let schema = VeilAttestationContractRef::casper_contract_schema();
            odra_build::schema(legacy, schema);
        }
        _ => {
            eprintln!("ODRA_MODULE not set or unknown. Use: VeilAttestation");
            std::process::exit(1);
        }
    }
}
