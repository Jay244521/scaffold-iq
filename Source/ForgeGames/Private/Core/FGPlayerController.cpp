#include "Core/FGPlayerController.h"

AFGPlayerController::AFGPlayerController()
{
}

void AFGPlayerController::Client_ShowTacticalPreview_Implementation(AActor* PreviewCameraActor, float Duration)
{
	if (!PreviewCameraActor)
	{
		return;
	}

	SetViewTargetWithBlend(PreviewCameraActor, 0.5f);

	GetWorldTimerManager().SetTimer(TacticalPreviewReturnHandle, this, &AFGPlayerController::Client_ReturnViewToPawn, Duration, false);
}

void AFGPlayerController::Client_ReturnViewToPawn_Implementation()
{
	if (GetPawn())
	{
		SetViewTargetWithBlend(GetPawn(), 0.5f);
	}
}
