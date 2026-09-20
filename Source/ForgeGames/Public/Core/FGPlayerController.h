#pragma once

#include "CoreMinimal.h"
#include "GameFramework/PlayerController.h"
#include "FGPlayerController.generated.h"

UCLASS()
class FORGEGAMES_API AFGPlayerController : public APlayerController
{
	GENERATED_BODY()

public:
	AFGPlayerController();

	/** Server call: blends every client's view to the overhead preview camera for Duration seconds. */
	UFUNCTION(Client, Reliable)
	void Client_ShowTacticalPreview(AActor* PreviewCameraActor, float Duration);

	/** Server call: returns the client's view to their possessed pawn. */
	UFUNCTION(Client, Reliable)
	void Client_ReturnViewToPawn();

private:
	FTimerHandle TacticalPreviewReturnHandle;
};
