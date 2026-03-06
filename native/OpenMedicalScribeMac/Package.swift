// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "OpenMedicalScribeMac",
    platforms: [
        .macOS(.v14)
    ],
    products: [
        .executable(name: "OpenMedicalScribeMac", targets: ["OpenMedicalScribeMac"])
    ],
    targets: [
        .executableTarget(
            name: "OpenMedicalScribeMac",
            path: "Sources/OpenMedicalScribeMac"
        ),
        .testTarget(
            name: "OpenMedicalScribeMacTests",
            dependencies: ["OpenMedicalScribeMac"],
            path: "Tests/OpenMedicalScribeMacTests"
        )
    ]
)
