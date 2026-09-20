#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "FGTacticalPreviewCamera.generated.h"

class UCameraComponent;
struct FFGSectorDefinition;

/**
 * Overhead camera every client's view blends to for the fixed-length tactical preview
 * at match start. FrameSectorGrid positions it once the map has been procedurally laid
 * out so the preview always shows the whole playable area regardless of grid size.
 */
UCLASS()
class FORGEGAMES_API AFGTacticalPreviewCamera : public AActor
{
	GENERATED_BODY()

public:
	AFGTacticalPreviewCamera();

	/** Repositions the camera directly above the generated sector grid's center. */
	UFUNCTION(BlueprintCallable, Category = "ForgeGames|Camera")
	void FrameSectorGrid(const TArray<FFGSectorDefinition>& SectorDefinitions, float Padding = 5000.f);

protected:
	UPROPERTY(VisibleAnywhere, Category = "ForgeGames|Camera")
	TObjectPtr<UCameraComponent> CameraComponent;

	/** Minimum height above the map regardless of grid footprint. */
	UPROPERTY(EditDefaultsOnly, Category = "ForgeGames|Camera")
	float MinOverheadHeight = 15000.f;
};
