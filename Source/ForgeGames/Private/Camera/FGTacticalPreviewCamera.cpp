#include "Camera/FGTacticalPreviewCamera.h"
#include "Camera/CameraComponent.h"
#include "Map/FGSectorGenerator.h"

AFGTacticalPreviewCamera::AFGTacticalPreviewCamera()
{
	PrimaryActorTick.bCanEverTick = false;
	bReplicates = false;

	SetRootComponent(CreateDefaultSubobject<USceneComponent>(TEXT("Root")));

	CameraComponent = CreateDefaultSubobject<UCameraComponent>(TEXT("CameraComponent"));
	CameraComponent->SetupAttachment(GetRootComponent());
	CameraComponent->SetWorldRotation(FRotator(-90.f, 0.f, 0.f));
}

void AFGTacticalPreviewCamera::FrameSectorGrid(const TArray<FFGSectorDefinition>& SectorDefinitions, float Padding)
{
	if (SectorDefinitions.Num() == 0)
	{
		return;
	}

	FBox Bounds(EForceInit::ForceInit);
	for (const FFGSectorDefinition& SectorDefinition : SectorDefinitions)
	{
		Bounds += SectorDefinition.WorldLocation;
	}

	const FVector Center = Bounds.GetCenter();
	const float LargestExtent = Bounds.GetExtent().GetMax() + Padding;

	// Rough framing heuristic: taller extents need a proportionally higher camera to stay
	// fully overhead with a standard ~90 degree field of view.
	const float RequiredHeight = FMath::Max(MinOverheadHeight, LargestExtent * 2.f);

	SetActorLocation(FVector(Center.X, Center.Y, RequiredHeight));
	SetActorRotation(FRotator(-90.f, 0.f, 0.f));
}
